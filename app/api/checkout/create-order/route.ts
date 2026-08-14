import { NextResponse } from "next/server";
import { AuditAction } from "@/lib/types";
import { requireAuthProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const SHIPPING_INR = 49;

type CheckoutPayload = {
  recipientName?: string;
  recipientPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  landmark?: string;
  deliveryNotes?: string;
};

function validateAddress(payload: CheckoutPayload) {
  const recipientName = cleanText(payload.recipientName ?? "", 80);
  const recipientPhone = cleanText(payload.recipientPhone ?? "", 20);
  const addressLine1 = cleanText(payload.addressLine1 ?? "", 160);
  const addressLine2 = cleanText(payload.addressLine2 ?? "", 160) || null;
  const city = cleanText(payload.city ?? "", 80);
  const state = cleanText(payload.state ?? "", 80);
  const postalCode = cleanText(payload.postalCode ?? "", 20);
  const country = cleanText(payload.country ?? "India", 80) || "India";
  const landmark = cleanText(payload.landmark ?? "", 100) || null;
  const deliveryNotes = cleanText(payload.deliveryNotes ?? "", 300) || null;

  const phonePattern = /^[0-9+\-()\s]{8,20}$/;
  const postalPattern = /^[A-Za-z0-9\- ]{4,12}$/;

  if (!recipientName || !recipientPhone || !addressLine1 || !city || !state || !postalCode) {
    return { error: "Missing required shipping fields" } as const;
  }

  if (!phonePattern.test(recipientPhone)) {
    return { error: "Invalid phone number" } as const;
  }

  if (!postalPattern.test(postalCode)) {
    return { error: "Invalid postal code" } as const;
  }

  return {
    value: {
      recipientName,
      recipientPhone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      landmark,
      deliveryNotes,
    },
  } as const;
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`checkout:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Missing Razorpay env" }, { status: 500 });
  }

  const body = (await request.json()) as CheckoutPayload;
  const validated = validateAddress(body);

  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Fetch cart items with product and variation details
  const { data: cart, error: cartError } = await supabase
    .from('cart_items')
    .select(`
      *,
      products (
        id,
        name,
        status
      ),
      product_variations (
        id,
        label,
        price_inr,
        stock
      )
    `)
    .eq('profile_id', profile.id);

  if (cartError || !cart) {
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }

  if (cart.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const unavailableItems = cart.filter(
    (item: any) =>
      item.products.status !== 'ACTIVE' ||
      item.product_variations.stock < item.quantity,
  );

  if (unavailableItems.length > 0) {
    const details = unavailableItems.map((item: any) => ({
      productId: item.product_id,
      name: item.products.name,
      variation: item.product_variations.label,
      requestedQty: item.quantity,
      availableStock: item.product_variations.stock,
      status: item.products.status,
    }));

    await writeAuditLog({
      action: "CHECKOUT_INIT",
      actorUserId: profile.clerk_user_id,
      metadata: { details },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error:
          "One or more items are out of stock or unavailable. Please update your cart.",
        details,
      },
      { status: 409 },
    );
  }

  const subtotalInr = cart.reduce((sum: number, row: any) => sum + row.quantity * row.product_variations.price_inr, 0);
  const totalInr = subtotalInr + SHIPPING_INR;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      profile_id: profile.id,
      subtotal_inr: subtotalInr,
      shipping_inr: SHIPPING_INR,
      total_inr: totalInr,
      status: 'PENDING',
      recipient_name: validated.value.recipientName,
      recipient_phone: validated.value.recipientPhone,
      address_line1: validated.value.addressLine1,
      address_line2: validated.value.addressLine2,
      city: validated.value.city,
      state: validated.value.state,
      postal_code: validated.value.postalCode,
      country: validated.value.country,
      landmark: validated.value.landmark,
      delivery_notes: validated.value.deliveryNotes,
    }])
    .select()
    .single();

  if (orderError || !order) {
    console.error('Order creation error:', orderError);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // Create order items
  const orderItems = cart.map((item: any) => ({
    order_id: order.id,
    product_id: item.product_id,
    variation_id: item.variation_id,
    quantity: item.quantity,
    unit_price_inr: item.product_variations.price_inr,
    variation_label: item.product_variations.label,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('Order items creation error:', itemsError);
    await supabase.from('orders').update({ status: 'FAILED' }).eq('id', order.id);
    return NextResponse.json({ error: "Failed to create order items" }, { status: 500 });
  }

  const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: totalInr * 100,
      currency: "INR",
      receipt: order.id,
      notes: {
        profileId: profile.id,
        city: validated.value.city,
        postalCode: validated.value.postalCode,
      },
    }),
  });

  if (!razorpayRes.ok) {
    const errorBody = await razorpayRes.text();
    await supabase.from('orders').update({ status: 'FAILED' }).eq('id', order.id);

    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: { reason: "razorpay_order_create_failed", errorBody },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Unable to create payment order" }, { status: 500 });
  }

  const razorpayOrder = (await razorpayRes.json()) as { id: string };

  await supabase.from('orders').update({ razorpay_order_id: razorpayOrder.id }).eq('id', order.id);

  await writeAuditLog({
    action: "CHECKOUT_INIT",
    actorUserId: profile.clerk_user_id,
    metadata: {
      amountInr: totalInr,
      city: validated.value.city,
      postalCode: validated.value.postalCode,
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    amountPaise: totalInr * 100,
    currency: "INR",
    razorpayKeyId: keyId,
    prefill: {
      name: validated.value.recipientName,
      email: profile.email,
      contact: validated.value.recipientPhone,
    },
  });
}
