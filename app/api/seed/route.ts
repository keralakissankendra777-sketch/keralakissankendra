import { NextResponse } from "next/server";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminProfile } from "@/lib/auth";
import { getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";

const sample = [
  {
    name: "Monstera Deliciosa",
    slug: "monstera-deliciosa",
    description: "Large split leaves, ideal for bright indoor corners.",
    imageUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
    priceInr: 799,
    stock: 24,
    category: "Indoor",
  },
  {
    name: "Snake Plant",
    slug: "snake-plant",
    description: "Low maintenance and excellent air purifier.",
    imageUrl:
      "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=900&q=80",
    priceInr: 499,
    stock: 40,
    category: "Indoor",
  },
  {
    name: "Peace Lily",
    slug: "peace-lily",
    description: "Elegant blooms with rich green foliage.",
    imageUrl:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80",
    priceInr: 699,
    stock: 18,
    category: "Flowering",
  },
  {
    name: "Areca Palm",
    slug: "areca-palm",
    description: "Tropical look that thrives in medium light.",
    imageUrl:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80",
    priceInr: 1199,
    stock: 12,
    category: "Palms",
  },
];

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAdminProfile();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`seed:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const categoryMap = new Map<string, string>();

  for (const row of sample) {
    if (!categoryMap.has(row.category)) {
      const category = await prisma.category.upsert({
        where: { slug: row.category.toLowerCase() },
        update: {},
        create: {
          name: row.category,
          slug: row.category.toLowerCase(),
        },
      });
      categoryMap.set(row.category, category.id);
    }
  }

  for (const row of sample) {
    const product = await prisma.product.upsert({
      where: { slug: row.slug },
      update: {
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        priceInr: row.priceInr,
        stock: row.stock,
        status: ProductStatus.ACTIVE,
      },
      create: {
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl: row.imageUrl,
        priceInr: row.priceInr,
        stock: row.stock,
        status: ProductStatus.ACTIVE,
        categoryId: categoryMap.get(row.category)!,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: row.imageUrl,
        sortOrder: 0,
      },
    });
  }

  return NextResponse.json({ ok: true, seeded: sample.length });
}
