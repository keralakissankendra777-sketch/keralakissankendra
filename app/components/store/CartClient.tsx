"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import CartSummary from "@/app/components/store/CartSummary";

type CartRow = {
  quantity: number;
  product: {
    id: string;
    name: string;
    priceInr: number;
    imageUrl: string;
  };
};

type Props = {
  initialItems: CartRow[];
};

export default function CartClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  const subtotal = useMemo(() => {
    return items.reduce((sum, row) => sum + row.product.priceInr * row.quantity, 0);
  }, [items]);

  const updateQty = async (productId: string, quantity: number) => {
    const res = await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((row) => (row.product.id === productId ? { ...row, quantity } : row)));
    }
  };

  const remove = async (productId: string) => {
    const res = await fetch(`/api/cart?productId=${productId}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((row) => row.product.id !== productId));
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-black text-zinc-900">Your Cart</h1>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-zinc-600">No items in cart.</p>
        ) : (
          items.map((row) => (
            <article key={row.product.id} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <Image
                src={row.product.imageUrl}
                alt={row.product.name}
                width={96}
                height={96}
                className="h-24 w-24 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h2 className="font-bold text-zinc-900">{row.product.name}</h2>
                <p className="text-sm text-zinc-600">Rs. {row.product.priceInr}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2"
                    onClick={() => updateQty(row.product.id, Math.max(1, row.quantity - 1))}
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm">{row.quantity}</span>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2"
                    onClick={() => updateQty(row.product.id, Math.min(10, row.quantity + 1))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ml-4 text-sm font-semibold text-rose-600"
                    onClick={() => remove(row.product.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
      <CartSummary subtotalInr={subtotal} />
    </div>
  );
}
