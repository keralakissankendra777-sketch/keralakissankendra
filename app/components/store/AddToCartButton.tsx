"use client";

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  productId: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
};

export default function AddToCartButton({ productId, className = "", label = "Add to Cart", iconOnly = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [errorText, setErrorText] = useState("");

  const addToCart = async () => {
    if (loading) return;
    setLoading(true);
    setErrorText("");

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const message = data.error ?? "Failed to add item to cart";
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setErrorText(message);
        return;
      }

      setAdded(true);
      window.setTimeout(() => setAdded(false), 1200);
    } catch {
      setErrorText("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={addToCart}
        disabled={loading}
        aria-label={iconOnly ? label : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 ${
          iconOnly ? "h-10 w-10 p-0" : "w-full"
        } ${className}`}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {!iconOnly ? "Adding..." : null}
          </>
        ) : added ? (
          <>
            <Check size={18} strokeWidth={2.5} />
            {!iconOnly ? "Added" : null}
          </>
        ) : iconOnly ? (
          <Plus size={20} strokeWidth={2.5} />
        ) : (
          label
        )}
      </button>
      {errorText ? <p className="text-xs text-red-500">{errorText}</p> : null}
    </div>
  );
}
