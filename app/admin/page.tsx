import { redirect } from "next/navigation";
import AdminDashboardClient from "@/app/components/admin/AdminDashboardClient";
import { requireAdminProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { normalizeAdminOrder } from "@/lib/orders";

const INITIAL_PAGE_SIZE = 10;

export default async function AdminPage() {
  const profile = await requireAdminProfile();

  if (!profile) {
    redirect("/");
  }

  const [productsResult, ordersResult, totalOrdersResult] = await Promise.all([
    supabase
      .from("products")
      .select(`
        *,
        category:categories (*),
        images:product_images (id, url, sort_order),
        variations:product_variations (id, size_code, custom_size_label, label, price_inr, stock, sort_order)
      `)
      .order("created_at", { ascending: false }),
    
    supabase
      .from("orders")
      .select(`
        *,
        profile:user_profiles (email, full_name),
        items:order_items (
          *,
          product:products (*),
          variation:product_variations (label)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(INITIAL_PAGE_SIZE),
    
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  const products = (productsResult.data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    status: row.status,
    category: row.category,
    images: (row.images ?? []).map((image: any) => ({
      id: image.id,
      url: image.url,
      sortOrder: image.sort_order,
    })),
    variations: (row.variations ?? []).map((variation: any) => ({
      id: variation.id,
      sizeCode: variation.size_code,
      customSizeLabel: variation.custom_size_label,
      label: variation.label,
      priceInr: variation.price_inr,
      stock: variation.stock,
      sortOrder: variation.sort_order,
    })),
  }));
  const orders = (ordersResult.data || []).map((row: any) => normalizeAdminOrder(row));
  const totalOrders = totalOrdersResult.count ?? 0;

  return (
    <AdminDashboardClient
      initialProducts={products}
      initialOrders={orders}
      initialOrderPage={1}
      initialTotalOrders={totalOrders}
      pageSize={INITIAL_PAGE_SIZE}
    />
  );
}
