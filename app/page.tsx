import Image from "next/image";
import { ProductStatus } from "@prisma/client";
import AddToCartButton from "@/app/components/store/AddToCartButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-12">
        <div className="rounded-3xl bg-emerald-700 p-8 text-white shadow-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-200">Indoor Storefront</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">Fresh plants delivered in 24 hours.</h1>
          
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <Image
              src={product.images[0]?.url ?? product.imageUrl}
              alt={product.name}
              width={900}
              height={520}
              className="h-52 w-full object-cover"
            />
            <div className="space-y-3 p-5">
              <p className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                {product.category.name}
              </p>
              <h2 className="text-xl font-bold text-zinc-900">{product.name}</h2>
              <p className="text-sm text-zinc-600">{product.description}</p>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-lg font-extrabold text-zinc-900">Rs. {product.priceInr}</p>
                  <p className="text-xs text-zinc-500">Stock: {product.stock}</p>
                </div>
              </div>
              <AddToCartButton productId={product.id} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
