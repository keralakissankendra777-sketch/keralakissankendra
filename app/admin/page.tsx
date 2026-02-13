import { redirect } from "next/navigation";
import AdminDashboardClient from "@/app/components/admin/AdminDashboardClient";
import { requireAdminProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INITIAL_PAGE_SIZE = 10;

export default async function AdminPage() {
  const profile = await requireAdminProfile();

  if (!profile) {
    redirect("/");
  }

  const [products, orders, totalOrders] = await Promise.all([
    prisma.product.findMany({
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
    }),
    prisma.order.findMany({
      include: {
        profile: {
          select: {
            email: true,
            fullName: true,
          },
        },
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
      },
      orderBy: { createdAt: "desc" },
      take: INITIAL_PAGE_SIZE,
    }),
    prisma.order.count(),
  ]);

  return (
    <AdminDashboardClient
      initialProducts={products}
      initialOrders={orders}
      initialOrderPage={1}
      initialTotalOrders={totalOrders}
      pageSize={INITIAL_PAGE_SIZE}
    />
  );
}
