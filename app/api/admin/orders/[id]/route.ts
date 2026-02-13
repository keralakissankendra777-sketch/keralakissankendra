import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth";
import { parseOrderStatus, parseShipmentStatus } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { cleanHttpUrl, cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:orders:update:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      payment: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    status?: string;
    shipmentStatus?: string;
    shippingProvider?: string;
    shippingTrackingId?: string;
    shippingInstructions?: string;
    shippingUrl?: string;
    markShipped?: boolean;
  };

  const statusProvided = typeof body.status !== "undefined";
  const status = statusProvided ? parseOrderStatus(body.status) : null;
  const shipmentStatusProvided = typeof body.shipmentStatus !== "undefined";
  const shipmentStatus = shipmentStatusProvided ? parseShipmentStatus(body.shipmentStatus) : null;

  if (statusProvided && !status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (shipmentStatusProvided && !shipmentStatus) {
    return NextResponse.json({ error: "Invalid shipment status" }, { status: 400 });
  }

  const shippingProvider = cleanText(body.shippingProvider ?? "", 80) || null;
  const shippingTrackingId = cleanText(body.shippingTrackingId ?? "", 120) || null;
  const shippingInstructions = cleanText(body.shippingInstructions ?? "", 500) || null;
  const shippingUrlInput = (body.shippingUrl ?? "").trim();
  const shippingUrl = cleanHttpUrl(shippingUrlInput, 300);

  if (shippingUrlInput && !shippingUrl) {
    return NextResponse.json({ error: "Invalid tracking URL" }, { status: 400 });
  }

  const effectiveStatus = status ?? existingOrder.status;
  if (status === "PAID" && existingOrder.status !== "PAID" && !existingOrder.payment) {
    return NextResponse.json(
      { error: "Cannot mark order as PAID without a verified payment record" },
      { status: 400 },
    );
  }

  if (body.markShipped) {
    if (effectiveStatus !== "PAID") {
      return NextResponse.json({ error: "Only PAID orders can be marked as shipped" }, { status: 400 });
    }

    if (!shippingProvider || !shippingTrackingId) {
      return NextResponse.json(
        { error: "Shipping provider and tracking ID are required before marking shipped" },
        { status: 400 },
      );
    }
  }

  const data: {
    status?: NonNullable<typeof status>;
    shipmentStatus?: NonNullable<typeof shipmentStatus>;
    shippingProvider?: string | null;
    shippingTrackingId?: string | null;
    shippingInstructions?: string | null;
    shippingUrl?: string | null;
    shippedAt?: Date | null;
  } = {};

  if (status) {
    data.status = status;
  }
  if (shipmentStatus) {
    data.shipmentStatus = shipmentStatus;
  }

  data.shippingProvider = shippingProvider;
  data.shippingTrackingId = shippingTrackingId;
  data.shippingInstructions = shippingInstructions;
  data.shippingUrl = shippingUrl;

  if (typeof body.markShipped === "boolean") {
    data.shippedAt = body.markShipped ? new Date() : null;
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: {
      profile: {
        select: {
          email: true,
          fullName: true,
        },
      },
      items: {
        include: {
          product: true,
          variation: {
            select: {
              label: true,
            },
          },
        },
      },
    },
  });

  await writeAuditLog({
    action: AuditAction.ADMIN_ORDER_UPDATE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: id,
    metadata: {
      status: status ?? undefined,
      shipmentStatus: shipmentStatus ?? undefined,
      shippingProvider,
      shippingTrackingId,
      markShipped: body.markShipped,
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, order });
}
