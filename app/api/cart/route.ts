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
    include: { product: true },
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
    productId?: string;
    quantity?: number;
  };

  const productId = cleanText(body.productId ?? "", 80);
  const quantity = Number(body.quantity ?? 1);

  if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [product, existing] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.cartItem.findFirst({
      where: {
        profileId: profile.id,
        productId,
      },
    }),
  ]);

  if (!product || product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: "Product unavailable" }, { status: 400 });
  }

  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > 10 || nextQuantity > product.stock) {
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
        productId,
        quantity,
      },
    });
  }

  await writeAuditLog({
    action: AuditAction.CART_ADD,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: productId,
    metadata: { quantity },
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
    productId?: string;
    quantity?: number;
  };

  const productId = cleanText(body.productId ?? "", 80);
  const quantity = Number(body.quantity ?? 1);

  if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== ProductStatus.ACTIVE || product.stock < quantity) {
    return NextResponse.json({ error: "Requested quantity exceeds stock" }, { status: 409 });
  }

  const updated = await prisma.cartItem.updateMany({
    where: {
      profileId: profile.id,
      productId,
    },
    data: { quantity },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

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
  const productId = cleanText(searchParams.get("productId") ?? "", 80);

  if (!productId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const deleted = await prisma.cartItem.deleteMany({
    where: {
      profileId: profile.id,
      productId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  await writeAuditLog({
    action: AuditAction.CART_REMOVE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: productId,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
