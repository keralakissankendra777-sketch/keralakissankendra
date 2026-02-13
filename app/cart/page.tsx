import CartClient from "@/app/components/store/CartClient";
import { requireAuthProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CartPage() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return <div className="mx-auto max-w-6xl px-4 pb-10 pt-28">Unauthorized</div>;
  }

  const items = await prisma.cartItem.findMany({
    where: { profileId: profile.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      variation: {
        select: {
          id: true,
          label: true,
          priceInr: true,
          stock: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <CartClient initialItems={items} />;
}
