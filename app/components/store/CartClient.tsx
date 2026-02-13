"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import CartSummary from "@/app/components/store/CartSummary";

type CartRow = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    imageUrl: string;
  };
  variation: {
    id: string;
    label: string;
    priceInr: number;
    stock: number;
  };
};

type Props = {
  initialItems: CartRow[];
};

export default function CartClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  const subtotal = useMemo(() => {
    return items.reduce((sum, row) => sum + row.variation.priceInr * row.quantity, 0);
  }, [items]);

  const updateQty = async (cartItemId: string, quantity: number) => {
    const res = await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartItemId, quantity }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((row) => (row.id === cartItemId ? { ...row, quantity } : row)));
    }
  };

  const remove = async (cartItemId: string) => {
    const res = await fetch(`/api/cart?cartItemId=${cartItemId}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((row) => row.id !== cartItemId));
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-10 pt-28 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-zinc-900">Order Summary</h1>
          <p className="mt-1 text-sm text-zinc-500">Review your items before checkout.</p>
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-zinc-600 shadow-sm">No items in cart.</p>
        ) : (
          items.map((row) => (
            <article key={row.id} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <Image
                src={row.product.imageUrl}
                alt={row.product.name}
                width={96}
                height={96}
                className="h-24 w-24 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h2 className="font-bold text-zinc-900">{row.product.name}</h2>
                <p className="text-xs font-semibold text-zinc-500">Variation: {row.variation.label}</p>
                <p className="text-sm text-zinc-600">Rs. {row.variation.priceInr}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full bg-zinc-100 p-1">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-200"
                      onClick={() => updateQty(row.id, Math.max(1, row.quantity - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[26px] text-center text-sm font-bold text-zinc-700">{row.quantity}</span>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-200"
                      onClick={() =>
                        updateQty(
                          row.id,
                          Math.max(1, Math.min(10, row.variation.stock, row.quantity + 1)),
                        )
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">Rs. {row.variation.priceInr * row.quantity}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                    onClick={() => remove(row.id)}
                  >
                    <Trash2 size={14} /> Remove
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
