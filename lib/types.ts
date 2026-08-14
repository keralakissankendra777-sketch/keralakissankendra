// TypeScript type definitions for Supabase database
// These types match the Supabase schema structure

export const UserRole = {
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ShipmentStatus = {
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  ITEM_PACKED: 'ITEM_PACKED',
  ITEM_SHIPPED: 'ITEM_SHIPPED',
} as const;
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const AuditAction = {
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CART_UPDATED: 'CART_UPDATED',
  ADMIN_ACTION: 'ADMIN_ACTION',
  SYSTEM_EVENT: 'SYSTEM_EVENT',
  SIGN_IN: 'SIGN_IN',
  SIGN_UP: 'SIGN_UP',
  ADMIN_PRODUCT_CREATE: 'ADMIN_PRODUCT_CREATE',
  ADMIN_PRODUCT_UPDATE: 'ADMIN_PRODUCT_UPDATE',
  ADMIN_PRODUCT_DELETE: 'ADMIN_PRODUCT_DELETE',
  ADMIN_ORDER_UPDATE: 'ADMIN_ORDER_UPDATE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

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
