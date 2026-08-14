import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getClientIp, isRateLimited } from "@/lib/security";

export async function GET(request: Request) {
  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:orders:list:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawPageSize = Number(searchParams.get("pageSize") ?? "10");

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) ? Math.min(Math.max(rawPageSize, 1), 50) : 10;

  const supabase = getSupabaseClient();
  const offset = (page - 1) * pageSize;

  // Fetch orders with related data
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      *,
      user_profiles (
        email,
        full_name
      ),
      order_items (
        *,
        products (
          id,
          name,
          slug,
          image_url
        ),
        product_variations (
          label
        )
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  // Get total count
  const { count: total, error: countError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting orders:', countError);
  }

  // Transform data
  const transformedOrders = orders?.map((order: any) => ({
    id: order.id,
    userId: order.user_id,
    razorpayOrderId: order.razorpay_order_id,
    amountInr: order.amount_inr,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    profile: {
      email: order.user_profiles?.email,
      fullName: order.user_profiles?.full_name
    },
    items: order.order_items?.map((item: any) => ({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      variationId: item.variation_id,
      quantity: item.quantity,
      priceInr: item.price_inr,
      product: item.products,
      variation: item.product_variations
    })) || []
  }));

  return NextResponse.json({
    orders: transformedOrders,
    page,
    pageSize,
    total: total || 0,
    totalPages: Math.max(1, Math.ceil((total || 0) / pageSize)),
  });
}
