import { redirect } from "next/navigation";
import AdminDashboardClient from "@/app/components/admin/AdminDashboardClient";
import { requireAdminProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
        images:product_images (id, url, sortOrder),
        variations:product_variations (id, label, priceInr, stock, potSize, sortOrder)
      `)
      .order("createdAt", { ascending: false }),
    
    supabase
      .from("orders")
      .select(`
        *,
        profile:user_profiles (email, fullName),
        items:order_items (
          *,
          product:products (*),
          variation:product_variations (label)
        )
      `)
      .order("createdAt", { ascending: false })
      .limit(INITIAL_PAGE_SIZE),
    
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  const products = productsResult.data || [];
  const orders = ordersResult.data || [];
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
