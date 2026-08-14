import { NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getClientIp, isRateLimited, isTrustedOrigin, verifyRazorpaySignature } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`checkout:verify:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    orderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };

  if (!body.orderId || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) {
    return NextResponse.json({ error: "Missing Razorpay secret" }, { status: 500 });
  }

  const isValid = verifyRazorpaySignature({
    razorpayOrderId: body.razorpayOrderId!,
    razorpayPaymentId: body.razorpayPaymentId!,
    razorpaySignature: body.razorpaySignature!,
    secret,
  });

  if (!isValid) {
    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: { reason: "invalid_signature" },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', body.orderId)
    .eq('profile_id', profile.id)
    .eq('razorpay_order_id', body.razorpayOrderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order was cancelled" }, { status: 409 });
  }

  // Check for existing payment
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', order.id)
    .single();

  if (existingPayment) {
    if (order.status !== "PAID") {
      await supabase.from('orders').update({ status: 'PAID' }).eq('id', order.id);
    }
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Verify payment with Razorpay
  const paymentLookupRes = await fetch(
    `https://api.razorpay.com/v1/payments/${body.razorpayPaymentId}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
      },
    },
  );

  if (!paymentLookupRes.ok) {
    const errorBody = await paymentLookupRes.text();
    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: { reason: "payment_lookup_failed", errorBody },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Could not validate payment details" }, { status: 502 });
  }

  const paymentDetails = (await paymentLookupRes.json()) as {
    id?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };

  if (paymentDetails.id !== body.razorpayPaymentId || paymentDetails.order_id !== body.razorpayOrderId) {
    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: {
        reason: "payment_order_mismatch",
        paymentOrderId: paymentDetails.order_id,
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
  }

  if (paymentDetails.amount !== order.amount_inr * 100 || paymentDetails.currency !== "INR") {
    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: {
        reason: "payment_amount_mismatch",
        expectedAmountPaise: order.amount_inr * 100,
        receivedAmountPaise: paymentDetails.amount,
        receivedCurrency: paymentDetails.currency,
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Payment amount validation failed" }, { status: 400 });
  }

  if (paymentDetails.status !== "captured") {
    return NextResponse.json(
      { error: "Payment is not captured yet. Please wait and retry." },
      { status: 409 },
    );
  }

  try {
    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError || !items) {
      throw new Error('Failed to fetch order items');
    }

    // Update stock for each item
    for (const item of items) {
      if (!item.variation_id) {
        throw new Error(`missing_variation:${item.id}`);
      }

      // Check stock availability
      const { data: variation } = await supabase
        .from('product_variations')
        .select('stock')
        .eq('id', item.variation_id)
        .single();

      if (!variation || variation.stock < item.quantity) {
        throw new Error(`insufficient_stock:${item.variation_id}`);
      }

      // Decrement stock
      await supabase
        .from('product_variations')
        .update({ stock: variation.stock - item.quantity })
        .eq('id', item.variation_id);
    }

    // Create payment record
    await supabase.from('payments').insert([{
      order_id: order.id,
      razorpay_payment_id: body.razorpayPaymentId!,
      razorpay_signature: body.razorpaySignature!,
      amount_inr: order.amount_inr,
      status: 'COMPLETED',
    }]);

    // Update order status
    await supabase.from('orders').update({ status: 'PAID' }).eq('id', order.id);

    // Clear cart
    await supabase.from('cart_items').delete().eq('profile_id', profile.id);
  } catch (error) {
    // Check if payment was already processed
    const { data: postCheckPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .single();

    if (postCheckPayment) {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    const message = error instanceof Error ? error.message : "unknown";
    const stockError = message.startsWith("insufficient_stock:");

    if (stockError) {
      await supabase.from('orders').update({ status: 'FAILED' }).eq('id', order.id);
    }

    await writeAuditLog({
      action: "PAYMENT_FAILED",
      actorUserId: profile.clerk_user_id,
      metadata: {
        reason: stockError ? "stock_validation_failed_during_verify" : "verify_transaction_failed",
        error: message,
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    if (!stockError) {
      return NextResponse.json({ error: "Could not finalize payment. Please retry." }, { status: 500 });
    }

    return NextResponse.json(
      {
        error:
          "Payment captured but stock became unavailable before confirmation. Please contact support for refund/help.",
      },
      { status: 409 },
    );
  }

  await writeAuditLog({
    action: "PAYMENT_SUCCESS",
    actorUserId: profile.clerk_user_id,
    metadata: { razorpayPaymentId: body.razorpayPaymentId },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
