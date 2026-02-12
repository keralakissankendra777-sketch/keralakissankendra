import { NextResponse } from "next/server";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanText, getClientIp, isRateLimited } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);

  if (isRateLimited(`products:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = cleanText(searchParams.get("q") ?? "", 60).toLowerCase();

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await writeAuditLog({
    action: "PRODUCT_VIEW",
    metadata: { query },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ products });
}
