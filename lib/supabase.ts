import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Alias for compatibility with code previously written against a generic client.
export const supabase = supabaseAdmin;

export function getSupabaseClient() {
  return supabaseAdmin;
}

// Type definitions matching the database schema
export type UserProfile = {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  price_inr: number;
  stock: number;
  pot_size: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  category_id: string;
};

export type ProductImage = {
  id: string;
  url: string;
  sort_order: number;
  created_at: string;
  product_id: string;
};

export type ProductVariation = {
  id: string;
  size_code: 'S' | 'M' | 'L' | 'CUSTOM';
  custom_size_label?: string | null;
  label: string;
  price_inr: number;
  stock: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_id: string;
};

export type CartItem = {
  id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  profile_id: string;
  product_id: string;
  variation_id: string;
};

export type Order = {
  id: string;
  razorpay_order_id?: string | null;
  subtotal_inr: number;
  shipping_inr: number;
  total_inr: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  landmark?: string | null;
  delivery_notes?: string | null;
  shipping_provider?: string | null;
  shipping_tracking_id?: string | null;
  shipment_status: 'ORDER_RECEIVED' | 'ITEM_PACKED' | 'ITEM_SHIPPED' | 'ITEM_DELIVERED';
  shipping_instructions?: string | null;
  shipping_url?: string | null;
  shipped_at?: string | null;
  created_at: string;
  updated_at: string;
  profile_id: string;
};

export type OrderItem = {
  id: string;
  quantity: number;
  unit_price_inr: number;
  variation_label: string;
  order_id: string;
  product_id: string;
  variation_id?: string | null;
};

export type Payment = {
  id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount_inr: number;
  created_at: string;
  order_id: string;
};

export type AuditLog = {
  id: string;
  action: string;
  actor_user_id?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  profile_id?: string | null;
};
