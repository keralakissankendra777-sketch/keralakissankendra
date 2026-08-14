import CartClient from "@/app/components/store/CartClient";
import { requireAuthProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default async function CartPage() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return <div className="mx-auto max-w-6xl px-4 pb-10 pt-28">Unauthorized</div>;
  }

  const { data: rows } = await supabase
    .from("cart_items")
    .select(`
      id,
      quantity,
      product:products (id, name, image_url),
      variation:product_variations (id, label, price_inr, stock)
    `)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  const items = (rows ?? []).map((row: any) => ({
    id: row.id,
    quantity: row.quantity,
    product: {
      id: row.product?.id,
      name: row.product?.name,
      imageUrl: row.product?.image_url,
    },
    variation: {
      id: row.variation?.id,
      label: row.variation?.label,
      priceInr: row.variation?.price_inr,
      stock: row.variation?.stock,
    },
  }));

  return <CartClient initialItems={items} />;
}