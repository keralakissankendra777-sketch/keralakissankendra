import { notFound } from "next/navigation";
import { ProductStatus } from "@/lib/types";
import ProductDetailClient from "@/app/shop/ProductDetailClient";
import { supabase } from "@/lib/supabase";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await supabase.from("products").select({
    where: {
      slug,
      status: ProductStatus.ACTIVE,
      variations: {
        some: {},
      },
    },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      variations: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailClient
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        images: product.images,
        category: product.category,
        variations: product.variations.map((variation) => ({
          id: variation.id,
          label: variation.label,
          priceInr: variation.priceInr,
          stock: variation.stock,
        })),
      }}
    />
  );
}
