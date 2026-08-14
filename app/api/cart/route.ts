import { NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/auth";
import { getCartItems, addCartItem, updateCartItemQuantity, deleteCartItem, getProductVariationById, getCartItemByProfileAndVariation } from "@/lib/database";
import { cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await getCartItems(profile.id);

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
    getProductVariationById(variationId),
    getCartItemByProfileAndVariation(profile.id, variationId),
  ]);

  if (!variation || variation.product.status !== "ACTIVE") {
    return NextResponse.json({ error: "Product unavailable" }, { status: 400 });
  }

  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > 10 || nextQuantity > variation.stock) {
    return NextResponse.json({ error: "Requested quantity exceeds stock" }, { status: 409 });
  }

  if (existing) {
    await updateCartItemQuantity(existing.id, nextQuantity);
  } else {
    await addCartItem({
      profileId: profile.id,
      productId: variation.product_id,
      variationId,
      quantity,
    });
  }

  await writeAuditLog({
    action: "CART_ADD",
    actorUserId: profile.clerk_user_id,
    profileId: profile.id,
    target: variationId,
    metadata: { quantity, productId: variation.product_id },
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

  const items = await getCartItems(profile.id);
  const cartItem = items.find(item => item.id === cartItemId);

  if (!cartItem) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  if (
    cartItem.product.status !== "ACTIVE" ||
    cartItem.variation.stock < quantity
  ) {
    return NextResponse.json({ error: "Requested quantity exceeds stock" }, { status: 409 });
  }

  await updateCartItemQuantity(cartItem.id, quantity);

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

  const items = await getCartItems(profile.id);
  const existing = items.find(item => item.id === cartItemId);

  if (!existing) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  await deleteCartItem(cartItemId);

  await writeAuditLog({
    action: "CART_REMOVE",
    actorUserId: profile.clerk_user_id,
    profileId: profile.id,
    target: existing.variation_id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
