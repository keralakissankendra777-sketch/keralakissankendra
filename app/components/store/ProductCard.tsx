"use client";

import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    minPriceInr: number;
    totalStock: number;
    category: {
      name: string;
    };
    images?: Array<{
      url: string;
    }>;
  };
};

export default function ProductCard({ product }: ProductCardProps) {
  const coverImage = product.images?.[0]?.url ?? product.imageUrl;
  const isOutOfStock = product.totalStock < 1;
  const categoryLabel = product.category.name;

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-white transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
        isOutOfStock ? "opacity-75 grayscale-[0.35]" : ""
      }`}
    >
      <div className="relative h-64 overflow-hidden bg-zinc-50">
        <Image
          src={coverImage}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        {isOutOfStock ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <span className="rounded-full border-2 border-white bg-red-500 px-4 py-2 text-sm font-bold tracking-wide text-white">
              OUT OF STOCK
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
            {categoryLabel}
          </span>
        </div>

        <h3 className="mb-2 text-lg font-bold leading-tight text-zinc-800 transition-colors group-hover:text-emerald-700">
          {product.name}
        </h3>
        <p className="mb-3 line-clamp-2 text-sm text-zinc-500">{product.description}</p>

        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Starting at</p>
            <p className="text-2xl font-bold text-zinc-900">Rs. {product.minPriceInr}</p>
            <p className="text-xs text-zinc-500">Stock: {product.totalStock}</p>
          </div>
          <Link
            href={`/shop/${product.slug}`}
            className="min-w-[84px] rounded-xl bg-green-600 px-4 py-2 text-center text-sm font-bold text-white shadow-md hover:bg-green-700"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
