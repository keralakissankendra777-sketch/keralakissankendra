import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanHttpUrl, cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { parseProductStatus, slugify } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCategoryLabel, normalizePotSizeLabel } from "@/lib/catalog";

async function persistPotFields(
  productId: string,
  potSize: string,
) {
  await prisma.$executeRawUnsafe('UPDATE "Product" SET "potSize" = $1 WHERE "id" = $2', potSize, productId);
}

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
  if (isRateLimited(`admin:products:update:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    imageUrls?: string[];
    priceInr?: number;
    stock?: number;
    categoryName?: string;
    potSize?: string;
    status?: string;
  };

  const name = cleanText(body.name ?? "", 120);
  const rawDescription = cleanText(body.description ?? "", 600);
  const description = rawDescription || "No description provided.";
  const categoryName = cleanText(body.categoryName ?? "", 60);
  const rawImageUrls = (body.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const normalizedImageUrls = rawImageUrls.map((url) => cleanHttpUrl(url, 500));
  if (normalizedImageUrls.some((url) => !url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  const imageUrls = Array.from(new Set(normalizedImageUrls as string[]));
  const priceInr = Number(body.priceInr ?? 0);
  const stock = Number(body.stock ?? 0);
  const status = parseProductStatus(body.status);
  const categoryValue = normalizeCategoryLabel(categoryName);
  const potSizeValue = normalizePotSizeLabel(cleanText(body.potSize ?? "", 40)) || "Medium";

  if (
    !name ||
    imageUrls.length === 0 ||
    imageUrls.length > 8 ||
    !categoryValue ||
    categoryValue.length > 60 ||
    priceInr <= 0 ||
    stock < 0
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!potSizeValue || potSizeValue.length > 40) {
    return NextResponse.json({ error: "Invalid pot size" }, { status: 400 });
  }

  const categorySlug = slugify(categoryValue);
  const category = await prisma.category.upsert({
    where: { slug: categorySlug },
    update: {
      name: categoryValue,
      slug: categorySlug,
    },
    create: {
      name: categoryValue,
      slug: categorySlug,
    },
  });

  const product = await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });

    return tx.product.update({
      where: { id },
      data: {
        name,
        description,
        imageUrl: imageUrls[0],
        priceInr,
        stock,
        status,
        categoryId: category.id,
        images: {
          create: imageUrls.map((url, index) => ({ url, sortOrder: index })),
        },
      },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  });
  await persistPotFields(product.id, potSizeValue);

  const refreshedProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await writeAuditLog({
    action: AuditAction.ADMIN_PRODUCT_UPDATE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: product.id,
    metadata: {
      name,
      priceInr,
      stock,
      status,
      category: categoryValue,
      potSize: potSizeValue,
      imageCount: imageUrls.length,
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, product: refreshedProduct ?? product });
}

export async function DELETE(
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
  if (isRateLimited(`admin:products:delete:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Product cannot be deleted because it is linked to existing orders" },
      { status: 409 },
    );
  }

  await writeAuditLog({
    action: AuditAction.ADMIN_PRODUCT_DELETE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
