"use client";

import { useState } from "react";

type Props = {
  productId: string;
};

export default function AddToCartButton({ productId }: Props) {
  const [loading, setLoading] = useState(false);

  const addToCart = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "Failed to add item to cart");
        return;
      }

      alert("Added to cart");
    } catch {
      alert("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={addToCart}
      disabled={loading}
      className="w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Adding..." : "Add to Cart"}
    </button>
  );
}
