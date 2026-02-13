import { NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { profileId: profile.id },
    include: {
      items: {
        include: {
          product: true,
          variation: {
            select: {
              label: true,
            },
          },
        },
      },
      payment: {
        select: {
          razorpayPaymentId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ orders });
}
