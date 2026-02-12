"use client";

import Link from "next/link";

type Props = {
  subtotalInr: number;
};

export default function CartSummary({ subtotalInr }: Props) {
  const shipping = subtotalInr > 0 ? 49 : 0;
  const total = subtotalInr + shipping;

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Order Summary</h2>
      <div className="mt-5 space-y-3 text-sm text-zinc-700">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>Rs. {subtotalInr}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>Rs. {shipping}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold text-zinc-900">
          <span>Total</span>
          <span>Rs. {total}</span>
        </div>
      </div>
      <Link
        href="/checkout"
        className="mt-5 block rounded-xl bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Continue to Checkout
      </Link>
    </aside>
  );
}
