import { Suspense } from "react";
import ShopClient from "@/app/shop/ShopClient";

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 pt-28" />}>
      <ShopClient />
    </Suspense>
  );
}

