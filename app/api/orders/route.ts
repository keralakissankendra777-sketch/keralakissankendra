import { NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const profile = await requireAuthProfile();
  
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const supabase = getSupabaseClient();
  
  // Fetch orders with related data
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        products (
          id,
          name,
          slug,
          imageUrl
        ),
        product_variations (
          label
        )
      ),
      payments (
        razorpayPaymentId
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  // Transform data to match expected format
  const transformedOrders = orders?.map(order => ({
    id: order.id,
    userId: order.user_id,
    razorpayOrderId: order.razorpay_order_id,
    amountInr: order.amount_inr,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: order.order_items?.map(item => ({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      variationId: item.variation_id,
      quantity: item.quantity,
      priceInr: item.price_inr,
      createdAt: item.created_at,
      product: item.products,
      variation: item.product_variations
    })) || [],
    payment: order.payments?.[0] || null
  }));

  return NextResponse.json({ orders: transformedOrders });
}
