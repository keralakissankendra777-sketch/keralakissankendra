import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAdminProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanHttpUrl, cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { parseProductStatus, slugify } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCategoryLabel } from "@/lib/catalog";
import { getDerivedProductFields, parseVariationPayload } from "@/lib/variationUtils";

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
      variations: {
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
    variations?: unknown;
    categoryName?: string;
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
  const status = parseProductStatus(body.status);
  const categoryValue = normalizeCategoryLabel(categoryName);
  const parsedVariations = parseVariationPayload(body.variations);

  if (
    !name ||
    imageUrls.length === 0 ||
    imageUrls.length > 8 ||
    !categoryValue ||
    categoryValue.length > 60
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if ("error" in parsedVariations) {
    return NextResponse.json({ error: parsedVariations.error }, { status: 400 });
  }

  const { variations } = parsedVariations;
  const derived = getDerivedProductFields(variations);

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

  const product = await prisma.product.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      imageUrl: imageUrls[0],
      priceInr: derived.minPriceInr,
      stock: derived.totalStock,
      potSize: derived.defaultPotSize,
      status,
      categoryId: category.id,
      images: {
        create: imageUrls.map((url, index) => ({ url, sortOrder: index })),
      },
      variations: {
        create: variations,
      },
    },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      variations: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await writeAuditLog({
    action: AuditAction.ADMIN_PRODUCT_CREATE,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    target: product.id,
    metadata: {
      name,
      minPriceInr: derived.minPriceInr,
      totalStock: derived.totalStock,
      status,
      category: categoryValue,
      variations: variations.map((variation) => ({
        label: variation.label,
        priceInr: variation.priceInr,
        stock: variation.stock,
      })),
      imageCount: imageUrls.length,
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, product });
}
