"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import AddToCartButton from "@/app/components/store/AddToCartButton";

type ProductVariation = {
  id: string;
  label: string;
  priceInr: number;
  stock: number;
};

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  images: Array<{ id: string; url: string }>;
  category: {
    name: string;
  };
  variations: ProductVariation[];
};

type Props = {
  product: ProductDetail;
};

export default function ProductDetailClient({ product }: Props) {
  const orderedImages = product.images.length > 0 ? product.images : [{ id: product.id, url: product.imageUrl }];
  const [activeImage, setActiveImage] = useState(orderedImages[0]?.url ?? product.imageUrl);
  const [selectedVariationId, setSelectedVariationId] = useState(
    product.variations.find((variation) => variation.stock > 0)?.id ?? product.variations[0]?.id ?? "",
  );

  const selectedVariation = useMemo(
    () =>
      product.variations.find((variation) => variation.id === selectedVariationId) ??
      product.variations[0],
    [product.variations, selectedVariationId],
  );

  if (!selectedVariation) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-zinc-600">
          No variations are configured for this product yet.
        </p>
      </div>
    );
  }

  const inStock = selectedVariation.stock > 0;

  return (
    <div className="bg-white pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 text-sm text-zinc-500">
          <Link href="/shop" className="hover:text-emerald-700 hover:underline">
            Shop
          </Link>{" "}
          / <span className="text-zinc-700">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_1fr_340px]">
          <section className="xl:col-span-1">
            <div className="mx-auto max-w-[620px]">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <Image src={activeImage} alt={product.name} fill className="object-cover" />
              </div>

              {orderedImages.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {orderedImages.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveImage(image.url)}
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border ${
                        activeImage === image.url ? "border-emerald-600" : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <Image src={image.url} alt={product.name} fill className="object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="xl:col-span-1">
            <p className="mb-2 text-sm text-emerald-700">{product.category.name}</p>
            <h1 className="text-3xl font-semibold leading-tight text-zinc-900">{product.name}</h1>
            <div className="mt-4 border-b border-zinc-200 pb-4">
              <p className="text-sm text-zinc-500">Price</p>
              <p className="text-3xl text-zinc-900">Rs. {selectedVariation.priceInr}</p>
              <p className={`text-sm ${inStock ? "text-emerald-700" : "text-rose-600"}`}>
                {inStock ? `In stock (${selectedVariation.stock} left)` : "Currently unavailable"}
              </p>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-zinc-700">Size / Variation</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {product.variations.map((variation) => {
                  const selected = variation.id === selectedVariation.id;
                  return (
                    <button
                      key={variation.id}
                      type="button"
                      onClick={() => setSelectedVariationId(variation.id)}
                      className={`aspect-square rounded-lg border p-2 text-left ${
                        selected ? "border-emerald-600 bg-emerald-50" : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <p className="text-sm font-semibold leading-tight text-zinc-900">{variation.label}</p>
                        <p className="text-sm text-zinc-700">Rs. {variation.priceInr}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-zinc-900">About this item</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{product.description}</p>
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-zinc-300 bg-white p-5 xl:sticky xl:top-28">
            <p className="text-3xl text-zinc-900">Rs. {selectedVariation.priceInr}</p>
            <p className="mt-1 text-xs text-zinc-500">Inclusive of all taxes</p>
            <p className="mt-3 text-sm text-zinc-700">
              Size: <span className="font-semibold">{selectedVariation.label}</span>
            </p>
            <p className={`mt-1 text-sm ${inStock ? "text-emerald-700" : "text-rose-600"}`}>
              {inStock ? `In stock (${selectedVariation.stock})` : "Out of stock"}
            </p>
            <p className="mt-3 text-sm text-zinc-700">Delivery in 3-5 business days</p>

            <div className="mt-5">
              {inStock ? (
                <AddToCartButton
                  variationId={selectedVariation.id}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                  label="Add to Cart"
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-400"
                >
                  Sold Out
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
