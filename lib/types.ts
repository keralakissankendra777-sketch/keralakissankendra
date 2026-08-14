// TypeScript type definitions to replace @prisma/client
// These types mirror the Prisma schema for Supabase compatibility

export type UserRole = 'ADMIN' | 'CUSTOMER';

export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type ShipmentStatus = 'ORDER_RECEIVED' | 'ITEM_PACKED' | 'ITEM_SHIPPED';

export type AuditAction = 
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CART_UPDATED'
  | 'ADMIN_ACTION'
  | 'SYSTEM_EVENT';

export type PotSizeCode = 'S' | 'M' | 'L' | 'CUSTOM';

// Database entity types matching Supabase schema
export interface UserProfile {
  id: string;
  clerkUserId: string | null;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  minPriceInr: number;
  totalStock: number;
  defaultPotSize: string;
  status: ProductStatus;
  imageUrl: string | null;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariation {
  id: string;
  productId: string;
  sizeCode: PotSizeCode;
  customSizeLabel: string | null;
  label: string;
  priceInr: number;
  stock: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  variationId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  razorpayOrderId: string | null;
  amountInr: number;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variationId: string;
  quantity: number;
  priceInr: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  amountInr: number;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface Shipment {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
