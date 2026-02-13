import { NextResponse } from "next/server";
import { AuditAction, ProductStatus } from "@prisma/client";
import { requireAuthProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const postalPattern = /^[A-Za-z0-9\-\s]{4,12}$/;

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

  const cart = await prisma.cartItem.findMany({
    where: { profileId: profile.id },
    include: { product: true, variation: true },
  });

  if (cart.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const unavailableItems = cart.filter(
    (item) =>
      item.product.status !== ProductStatus.ACTIVE ||
      item.variation.stock < item.quantity,
  );

  if (unavailableItems.length > 0) {
    const details = unavailableItems.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      variation: item.variation.label,
      requestedQty: item.quantity,
      availableStock: item.variation.stock,
      status: item.product.status,
    }));

    await writeAuditLog({
      action: AuditAction.CHECKOUT_INIT,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: "stock_validation_failed",
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

  const subtotalInr = cart.reduce((sum, row) => sum + row.quantity * row.variation.priceInr, 0);
  const totalInr = subtotalInr + SHIPPING_INR;

  const order = await prisma.order.create({
    data: {
      profileId: profile.id,
      subtotalInr,
      shippingInr: SHIPPING_INR,
      totalInr,
      ...validated.value,
      items: {
        create: cart.map((item) => ({
          productId: item.productId,
          variationId: item.variationId,
          variationLabel: item.variation.label,
          quantity: item.quantity,
          unitPriceInr: item.variation.priceInr,
        })),
      },
    },
  });

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
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });

    await writeAuditLog({
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: order.id,
      metadata: { reason: "razorpay_order_create_failed", errorBody },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Unable to create payment order" }, { status: 500 });
  }

  const razorpayOrder = (await razorpayRes.json()) as { id: string };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      razorpayOrderId: razorpayOrder.id,
    },
  });

  await writeAuditLog({
    action: AuditAction.CHECKOUT_INIT,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: order.id,
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
