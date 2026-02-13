import { NextResponse } from "next/server";
import { AuditAction, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthProfile } from "@/lib/auth";
import { cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.cartItem.findMany({
    where: { profileId: profile.id },
    include: { product: true, variation: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
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
  if (isRateLimited(`cart:add:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    variationId?: string;
    quantity?: number;
  };

  const variationId = cleanText(body.variationId ?? "", 80);
  const quantity = Number(body.quantity ?? 1);

  if (!variationId || !Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [variation, existing] = await Promise.all([
    prisma.productVariation.findUnique({
      where: { id: variationId },
      include: { product: true },
    }),
    prisma.cartItem.findFirst({
      where: {
        profileId: profile.id,
        variationId,
      },
    }),
  ]);

  if (!variation || variation.product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: "Product unavailable" }, { status: 400 });
  }

  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > 10 || nextQuantity > variation.stock) {
    return NextResponse.json({ error: "Requested quantity exceeds stock" }, { status: 409 });
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: {
          increment: quantity,
        },
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        profileId: profile.id,
        productId: variation.productId,
        variationId,
        quantity,
      },
    });
  }

  await writeAuditLog({
    action: AuditAction.CART_ADD,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: variationId,
    metadata: { quantity, productId: variation.productId },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`cart:update:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    cartItemId?: string;
    quantity?: number;
  };

  const cartItemId = cleanText(body.cartItemId ?? "", 80);
  const quantity = Number(body.quantity ?? 1);

  if (!cartItemId || !Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      profileId: profile.id,
    },
    include: {
      variation: {
        include: { product: true },
      },
    },
  });

  if (!cartItem) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  if (
    cartItem.variation.product.status !== ProductStatus.ACTIVE ||
    cartItem.variation.stock < quantity
  ) {
    return NextResponse.json({ error: "Requested quantity exceeds stock" }, { status: 409 });
  }

  await prisma.cartItem.update({
    where: { id: cartItem.id },
    data: { quantity },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`cart:remove:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const cartItemId = cleanText(searchParams.get("cartItemId") ?? "", 80);

  if (!cartItemId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      profileId: profile.id,
    },
    select: {
      id: true,
      variationId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  await prisma.cartItem.delete({
    where: { id: existing.id },
  });

  await writeAuditLog({
    action: AuditAction.CART_REMOVE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: existing.variationId,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
