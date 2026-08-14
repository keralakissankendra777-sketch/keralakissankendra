import { notFound } from "next/navigation";
import { ProductStatus } from "@/lib/types";
import ProductDetailClient from "@/app/shop/ProductDetailClient";
import { supabase } from "@/lib/supabase";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *,
      category:categories (id, name),
      images:product_images (id, url, sort_order),
      variations:product_variations (id, label, price_inr, stock, sort_order)
    `)
    .eq("slug", slug)
    .eq("status", ProductStatus.ACTIVE)
    .order("sort_order", { ascending: true, foreignTable: "product_variations" })
    .single();

  if (error || !product) {
    notFound();
  }

  return (
    <ProductDetailClient
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.image_url,
        images: (product.images ?? []).map((image: any) => ({ id: image.id, url: image.url })),
        category: product.category,
        variations: (product.variations ?? []).map((variation: any) => ({
          id: variation.id,
          label: variation.label,
          priceInr: variation.price_inr,
          stock: variation.stock,
        })),
      }}
    />
  );
}
