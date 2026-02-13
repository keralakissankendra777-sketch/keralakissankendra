import { NextResponse } from "next/server";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanText, getClientIp, isRateLimited } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";
import { normalizePotSizeCode } from "@/lib/catalog";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);

  if (isRateLimited(`products:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = cleanText(searchParams.get("q") ?? "", 60).toLowerCase();
  const rawCategoryParam = cleanText(searchParams.get("category") ?? "", 60);
  const categoryParam = rawCategoryParam.toLowerCase() === "all" ? "" : rawCategoryParam;
  const potSizeParam = cleanText(searchParams.get("potSize") ?? "", 40);
  const sizeCodeParam = normalizePotSizeCode(potSizeParam);

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      category: categoryParam ? { name: { equals: categoryParam, mode: "insensitive" } } : undefined,
      variations: sizeCodeParam ? { some: { sizeCode: sizeCodeParam } } : { some: {} },
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
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
    orderBy: {
      createdAt: "desc",
    },
  });

  const normalizedProducts = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    category: product.category,
    images: product.images,
    variations: product.variations,
    minPriceInr: Math.min(...product.variations.map((variation) => variation.priceInr)),
    totalStock: product.variations.reduce((sum, variation) => sum + variation.stock, 0),
  }));

  await writeAuditLog({
    action: "PRODUCT_VIEW",
    metadata: { query, category: categoryParam, potSize: potSizeParam },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ products: normalizedProducts });
}
