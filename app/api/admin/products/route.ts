import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanHttpUrl, cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { parseProductStatus, slugify } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:products:list:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:products:create:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    imageUrls?: string[];
    priceInr?: number;
    stock?: number;
    categoryName?: string;
    status?: string;
  };

  const name = cleanText(body.name ?? "", 120);
  const description = cleanText(body.description ?? "", 600);
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

  if (!name || !description || imageUrls.length === 0 || imageUrls.length > 8 || !categoryName || priceInr <= 0 || stock < 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const categorySlug = slugify(categoryName);
  const category = await prisma.category.upsert({
    where: { slug: categorySlug },
    update: { name: categoryName },
    create: {
      name: categoryName,
      slug: categorySlug,
    },
  });

  const product = await prisma.product.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
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

  await writeAuditLog({
    action: AuditAction.ADMIN_PRODUCT_CREATE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: product.id,
    metadata: { name, priceInr, stock, status, imageCount: imageUrls.length },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, product });
}
