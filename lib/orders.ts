type RawOrderItem = {
  id: string;
  quantity: number;
  unit_price_inr?: number;
  variation_label?: string;
  product?: { name: string } | null;
  products?: { name: string } | null;
  variation?: { label: string } | null;
  product_variations?: { label: string } | null;
};

export type AdminOrder = {
  id: string;
  totalInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  shipmentStatus: "ORDER_RECEIVED" | "ITEM_PACKED" | "ITEM_SHIPPED" | "ITEM_DELIVERED";
  createdAt: string;
  updatedAt: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark: string | null;
  deliveryNotes: string | null;
  shippedAt: string | null;
  shippingProvider: string | null;
  shippingTrackingId: string | null;
  shippingInstructions: string | null;
  shippingUrl: string | null;
  profile: {
    email: string;
    fullName: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceInr: number;
    variationLabel: string;
    variation: { label: string } | null;
    product: { name: string };
  }>;
};

export function normalizeAdminOrder(row: any): AdminOrder {
  const profile = row.profile ?? row.user_profiles;
  const rawItems = (row.items ?? row.order_items ?? []) as RawOrderItem[];

  return {
    id: row.id,
    totalInr: row.total_inr,
    status: row.status,
    shipmentStatus: row.shipment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    landmark: row.landmark,
    deliveryNotes: row.delivery_notes,
    shippedAt: row.shipped_at,
    shippingProvider: row.shipping_provider,
    shippingTrackingId: row.shipping_tracking_id,
    shippingInstructions: row.shipping_instructions,
    shippingUrl: row.shipping_url,
    profile: {
      email: profile?.email ?? "",
      fullName: profile?.full_name ?? null,
    },
    items: rawItems.map((item) => {
      const variation = item.variation ?? item.product_variations;
      const product = item.product ?? item.products;
      return {
        id: item.id,
        quantity: item.quantity,
        unitPriceInr: item.unit_price_inr ?? 0,
        variationLabel: item.variation_label ?? "",
        variation: variation?.label ? { label: variation.label } : null,
        product: product ? { name: product.name } : { name: "Unknown product" },
      };
    }),
  };
}