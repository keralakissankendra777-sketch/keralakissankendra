import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAuthProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    razorpaySignature: body.razorpaySignature,
    secret,
  });

  if (!isValid) {
    await writeAuditLog({
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: body.orderId,
      metadata: { reason: "invalid_signature" },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: body.orderId,
      profileId: profile.id,
      razorpayOrderId: body.razorpayOrderId,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order was cancelled" }, { status: 409 });
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { orderId: order.id },
  });

  if (existingPayment) {
    if (order.status !== "PAID") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
    }
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

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
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: order.id,
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
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: order.id,
      metadata: {
        reason: "payment_order_mismatch",
        paymentOrderId: paymentDetails.order_id,
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
  }

  if (paymentDetails.amount !== order.totalInr * 100 || paymentDetails.currency !== "INR") {
    await writeAuditLog({
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: order.id,
      metadata: {
        reason: "payment_amount_mismatch",
        expectedAmountPaise: order.totalInr * 100,
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
    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });

      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count === 0) {
          throw new Error(`insufficient_stock:${item.productId}`);
        }
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          razorpayPaymentId: body.razorpayPaymentId!,
          razorpaySignature: body.razorpaySignature!,
          amountInr: order.totalInr,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });

      await tx.cartItem.deleteMany({
        where: { profileId: profile.id },
      });
    });
  } catch (error) {
    const postCheckPayment = await prisma.payment.findUnique({
      where: { orderId: order.id },
    });
    if (postCheckPayment) {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    const message = error instanceof Error ? error.message : "unknown";
    const stockError = message.startsWith("insufficient_stock:");

    if (stockError) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
    }

    await writeAuditLog({
      action: AuditAction.PAYMENT_FAILED,
      actorUserId: profile.clerkUserId,
      profileId: profile.id,
      target: order.id,
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
    action: AuditAction.PAYMENT_SUCCESS,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: order.id,
    metadata: { razorpayPaymentId: body.razorpayPaymentId },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
