import { NextResponse } from "next/server";
import { PotSizeCode, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminProfile } from "@/lib/auth";
import { getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { slugify } from "@/lib/admin";
import { getPotSizeDisplayLabel } from "@/lib/catalog";

type SampleVariation = {
  sizeCode: PotSizeCode;
  customSizeLabel?: string;
  priceInr: number;
  stock: number;
};

const sample: Array<{
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  category: string;
  variations: SampleVariation[];
}> = [
  {
    name: "Monstera Deliciosa",
    slug: "monstera-deliciosa",
    description: "Large split leaves, ideal for bright indoor corners.",
    imageUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
    category: "Indoor",
    variations: [
      { sizeCode: PotSizeCode.S, priceInr: 599, stock: 10 },
      { sizeCode: PotSizeCode.M, priceInr: 799, stock: 24 },
      { sizeCode: PotSizeCode.L, priceInr: 999, stock: 12 },
    ],
  },
  {
    name: "Snake Plant",
    slug: "snake-plant",
    description: "Low maintenance and excellent air purifier.",
    imageUrl:
      "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=900&q=80",
    category: "Indoor",
    variations: [
      { sizeCode: PotSizeCode.S, priceInr: 399, stock: 30 },
      { sizeCode: PotSizeCode.M, priceInr: 499, stock: 40 },
      { sizeCode: PotSizeCode.L, priceInr: 699, stock: 22 },
    ],
  },
  {
    name: "Peace Lily",
    slug: "peace-lily",
    description: "Elegant blooms with rich green foliage.",
    imageUrl:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80",
    category: "Outdoor",
    variations: [
      { sizeCode: PotSizeCode.M, priceInr: 699, stock: 18 },
      { sizeCode: PotSizeCode.L, priceInr: 899, stock: 12 },
    ],
  },
  {
    name: "Ceramic Pot Set",
    slug: "ceramic-pot-set",
    description: "Premium ceramic accessories for your indoor collection.",
    imageUrl:
      "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80",
    category: "Outdoor",
    variations: [
      {
        sizeCode: PotSizeCode.CUSTOM,
        customSizeLabel: "12 inch",
        priceInr: 899,
        stock: 25,
      },
    ],
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
      const slug = slugify(row.category);
      const category = await prisma.category.upsert({
        where: { slug },
        update: { name: row.category },
        create: {
          name: row.category,
          slug,
        },
      });
      categoryMap.set(row.category, category.id);
    }
  }

  for (const row of sample) {
    const minPriceInr = Math.min(...row.variations.map((variation) => variation.priceInr));
    const totalStock = row.variations.reduce((sum, variation) => sum + variation.stock, 0);
    const firstVariation = row.variations[0];
    const defaultPotSize = getPotSizeDisplayLabel(
      firstVariation.sizeCode,
      firstVariation.customSizeLabel,
    );

    const product = await prisma.product.upsert({
      where: { slug: row.slug },
      update: {
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        priceInr: minPriceInr,
        stock: totalStock,
        potSize: defaultPotSize,
        status: ProductStatus.ACTIVE,
        categoryId: categoryMap.get(row.category)!,
      },
      create: {
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl: row.imageUrl,
        priceInr: minPriceInr,
        stock: totalStock,
        potSize: defaultPotSize,
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

    await prisma.productVariation.deleteMany({ where: { productId: product.id } });
    await prisma.productVariation.createMany({
      data: row.variations.map((variation, index) => ({
        productId: product.id,
        sizeCode: variation.sizeCode,
        customSizeLabel: variation.customSizeLabel ?? null,
        label: getPotSizeDisplayLabel(variation.sizeCode, variation.customSizeLabel),
        priceInr: variation.priceInr,
        stock: variation.stock,
        sortOrder: index,
      })),
    });
  }

  return NextResponse.json({ ok: true, seeded: sample.length });
}
