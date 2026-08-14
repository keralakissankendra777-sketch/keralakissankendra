import { supabaseAdmin, UserProfile, Category, Product, ProductImage, ProductVariation, CartItem, Order, OrderItem, Payment, AuditLog } from './supabase';

// Helper to convert snake_case to camelCase
function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj) return obj as Record<string, unknown>;
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// User Profile operations
export async function getUserProfileByClerkId(clerkUserId: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function createUserProfile(profile: {
  clerkUserId: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role?: 'CUSTOMER' | 'ADMIN';
}): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert([{
      clerk_user_id: profile.clerkUserId,
      email: profile.email.toLowerCase().trim(),
      full_name: profile.fullName,
      phone: profile.phone,
      role: profile.role ?? 'CUSTOMER',
    }])
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function updateUserProfile(
  id: string,
  updates: Partial<{
    clerkUserId: string;
    fullName: string | null;
    phone: string | null;
    role: 'CUSTOMER' | 'ADMIN';
  }>
): Promise<UserProfile> {
  const updateData: Record<string, unknown> = {};
  if (updates.clerkUserId !== undefined) updateData.clerk_user_id = updates.clerkUserId;
  if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.role !== undefined) updateData.role = updates.role;

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

// Category operations
export async function upsertCategory(name: string, slug: string): Promise<Category> {
  const { data, error } = await supabaseAdmin.rpc('upsert_category', {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    // Fallback: try manual upsert
    const existing = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();

    if (existing.data) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('categories')
        .update({ name })
        .eq('slug', slug)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return updated as Category;
    }

    const { data: created, error: createError } = await supabaseAdmin
      .from('categories')
      .insert([{ name, slug }])
      .select()
      .single();

    if (createError) throw createError;
    return created as Category;
  }

  return data as Category;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as Category;
}

// Product operations
export async function getActiveProducts(filters?: {
  query?: string;
  category?: string;
  sizeCode?: string;
}): Promise<(Product & { images: ProductImage[]; variations: ProductVariation[]; category: Category })[]> {
  let query = supabaseAdmin
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variations:product_variations(*)
    `)
    .eq('status', 'ACTIVE');

  if (filters?.query) {
    query = query.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
  }

  if (filters?.category) {
    query = query.eq('category.name', filters.category);
  }

  if (filters?.sizeCode) {
    query = query.contains('variations', [{ size_code: filters.sizeCode }]);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
}

export async function getAllProductsWithDetails(): Promise<(Product & { 
  images: ProductImage[]; 
  variations: ProductVariation[]; 
  category: Category 
})[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variations:product_variations(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
}

export async function createProduct(productData: {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  priceInr: number;
  stock: number;
  potSize: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  categoryId: string;
  images: Array<{ url: string; sortOrder: number }>;
  variations: Array<{
    sizeCode: 'S' | 'M' | 'L' | 'CUSTOM';
    customSizeLabel?: string | null;
    label: string;
    priceInr: number;
    stock: number;
    sortOrder: number;
  }>;
}): Promise<Product & { images: ProductImage[]; variations: ProductVariation[]; category: Category }> {
  // Create product with nested inserts
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert([{
      name: productData.name,
      slug: productData.slug,
      description: productData.description,
      image_url: productData.imageUrl,
      price_inr: productData.priceInr,
      stock: productData.stock,
      pot_size: productData.potSize,
      status: productData.status,
      category_id: productData.categoryId,
    }])
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variations:product_variations(*)
    `)
    .single();

  if (error) throw error;

  const productId = (data as Product).id;

  // Insert images
  if (productData.images.length > 0) {
    await supabaseAdmin
      .from('product_images')
      .insert(productData.images.map(img => ({
        product_id: productId,
        url: img.url,
        sort_order: img.sortOrder,
      })));
  }

  // Insert variations
  if (productData.variations.length > 0) {
    await supabaseAdmin
      .from('product_variations')
      .insert(productData.variations.map(variation => ({
        product_id: productId,
        size_code: variation.sizeCode,
        custom_size_label: variation.customSizeLabel,
        label: variation.label,
        price_inr: variation.priceInr,
        stock: variation.stock,
        sort_order: variation.sortOrder,
      })));
  }

  // Fetch complete product with relations
  const { data: completeProduct, error: fetchError } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variations:product_variations(*)
    `)
    .eq('id', productId)
    .single();

  if (fetchError) throw fetchError;
  return completeProduct as any;
}

// Cart operations
export async function getCartItems(profileId: string): Promise<(CartItem & { 
  product: Product; 
  variation: ProductVariation 
})[]> {
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .select(`
      *,
      product:products(*),
      variation:product_variations(*)
    `)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
}

export async function getCartItemByProfileAndVariation(
  profileId: string,
  variationId: string
): Promise<CartItem | null> {
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .select('*')
    .eq('profile_id', profileId)
    .eq('variation_id', variationId)
    .single();

  if (error || !data) return null;
  return data as CartItem;
}

export async function addCartItem(cartItem: {
  profileId: string;
  productId: string;
  variationId: string;
  quantity: number;
}): Promise<void> {
  const existing = await getCartItemByProfileAndVariation(cartItem.profileId, cartItem.variationId);

  if (existing) {
    await supabaseAdmin
      .from('cart_items')
      .update({ quantity: existing.quantity + cartItem.quantity })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('cart_items')
      .insert([{
        profile_id: cartItem.profileId,
        product_id: cartItem.productId,
        variation_id: cartItem.variationId,
        quantity: cartItem.quantity,
      }]);
  }
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number): Promise<void> {
  await supabaseAdmin
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId);
}

export async function deleteCartItem(cartItemId: string): Promise<void> {
  await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);
}

export async function deleteCartItemsByProfile(profileId: string): Promise<void> {
  await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('profile_id', profileId);
}

// Order operations
export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Order;
}

export async function getOrderByProfileAndId(profileId: string, id: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return null;
  return data as Order;
}

export async function createOrder(orderData: {
  profileId: string;
  subtotalInr: number;
  shippingInr: number;
  totalInr: number;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string | null;
  deliveryNotes?: string | null;
  items: Array<{
    productId: string;
    variationId: string;
    variationLabel: string;
    quantity: number;
    unitPriceInr: number;
  }>;
}): Promise<Order> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert([{
      profile_id: orderData.profileId,
      subtotal_inr: orderData.subtotalInr,
      shipping_inr: orderData.shippingInr,
      total_inr: orderData.totalInr,
      recipient_name: orderData.recipientName,
      recipient_phone: orderData.recipientPhone,
      address_line1: orderData.addressLine1,
      address_line2: orderData.addressLine2,
      city: orderData.city,
      state: orderData.state,
      postal_code: orderData.postalCode,
      country: orderData.country,
      landmark: orderData.landmark,
      delivery_notes: orderData.deliveryNotes,
      status: 'PENDING',
      shipment_status: 'ORDER_RECEIVED',
    }])
    .select()
    .single();

  if (error) throw error;

  const orderId = (data as Order).id;

  // Insert order items
  if (orderData.items.length > 0) {
    await supabaseAdmin
      .from('order_items')
      .insert(orderData.items.map(item => ({
        order_id: orderId,
        product_id: item.productId,
        variation_id: item.variationId,
        variation_label: item.variationLabel,
        quantity: item.quantity,
        unit_price_inr: item.unitPriceInr,
      })));
  }

  return data as Order;
}

export async function updateOrderStatus(orderId: string, status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'): Promise<void> {
  await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', orderId);
}

export async function updateOrderRazorpayId(orderId: string, razorpayOrderId: string): Promise<void> {
  await supabaseAdmin
    .from('orders')
    .update({ razorpay_order_id: razorpayOrderId })
    .eq('id', orderId);
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw error;
  return (data as OrderItem[]) || [];
}

// Payment operations
export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !data) return null;
  return data as Payment;
}

export async function createPayment(paymentData: {
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amountInr: number;
}): Promise<Payment> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert([{
      order_id: paymentData.orderId,
      razorpay_payment_id: paymentData.razorpayPaymentId,
      razorpay_signature: paymentData.razorpaySignature,
      amount_inr: paymentData.amountInr,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Payment;
}

// Product Variation operations
export async function getProductVariationById(id: string): Promise<(ProductVariation & { product: Product }) | null> {
  const { data, error } = await supabaseAdmin
    .from('product_variations')
    .select(`
      *,
      product:products(*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as any;
}

export async function updateProductVariationStock(id: string, decrement: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('product_variations')
    .update({ stock: supabaseAdmin.rpc('decrement_stock', { variation_id: id, amount: decrement }) })
    .eq('id', id)
    .gte('stock', decrement)
    .select();

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Audit Log operations
export async function createAuditLog(log: {
  action: string;
  actorUserId?: string | null;
  profileId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin
      .from('audit_logs')
      .insert([{
        action: log.action,
        actor_user_id: log.actorUserId,
        profile_id: log.profileId,
        target: log.target,
        metadata: log.metadata,
        ip_address: log.ipAddress,
        user_agent: log.userAgent,
      }]);
  } catch (error) {
    console.error('audit-log-write-failed', error);
  }
}

// Admin: Get all orders
export async function getAllOrders(): Promise<(Order & { profile: UserProfile; items: OrderItem[] })[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      profile:user_profiles(*),
      items:order_items(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
}

// Admin: Update order shipment
export async function updateOrderShipment(orderId: string, updates: {
  shippingProvider?: string;
  shippingTrackingId?: string;
  shipmentStatus?: 'ORDER_RECEIVED' | 'ITEM_PACKED' | 'ITEM_SHIPPED';
  shippingUrl?: string;
  shippedAt?: string;
}): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.shippingProvider !== undefined) updateData.shipping_provider = updates.shippingProvider;
  if (updates.shippingTrackingId !== undefined) updateData.shipping_tracking_id = updates.shippingTrackingId;
  if (updates.shipmentStatus !== undefined) updateData.shipment_status = updates.shipmentStatus;
  if (updates.shippingUrl !== undefined) updateData.shipping_url = updates.shippingUrl;
  if (updates.shippedAt !== undefined) updateData.shipped_at = updates.shippedAt;

  await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId);
}

// Get order with all related details
export async function getOrderWithDetails(orderId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      profile:user_profiles(*),
      items:order_items(*),
      payment:payments(*)
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) return null;
  return data;
}

// Update order with details and return full object
export async function updateOrderWithDetails(
  orderId: string, 
  updates: {
    status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
    shipmentStatus?: 'ORDER_RECEIVED' | 'ITEM_PACKED' | 'ITEM_SHIPPED';
    shippingProvider?: string | null;
    shippingTrackingId?: string | null;
    shippingInstructions?: string | null;
    shippingUrl?: string | null;
    shippedAt?: Date | null;
  }
): Promise<any> {
  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.shipmentStatus !== undefined) updateData.shipment_status = updates.shipmentStatus;
  if (updates.shippingProvider !== undefined) updateData.shipping_provider = updates.shippingProvider;
  if (updates.shippingTrackingId !== undefined) updateData.shipping_tracking_id = updates.shippingTrackingId;
  if (updates.shippingInstructions !== undefined) updateData.shipping_instructions = updates.shippingInstructions;
  if (updates.shippingUrl !== undefined) updateData.shipping_url = updates.shippingUrl;
  if (updates.shippedAt !== undefined) updateData.shipped_at = updates.shippedAt;

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select(`
      *,
      profile:user_profiles(*),
      items:order_items(*),
      payment:payments(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

