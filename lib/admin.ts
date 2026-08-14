import { OrderStatus, ProductStatus, ShipmentStatus } from "./types";

const PRODUCT_STATUS_VALUES = new Set<string>(Object.values(ProductStatus));
const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus));
const SHIPMENT_STATUS_VALUES = new Set<string>(Object.values(ShipmentStatus));

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseProductStatus(status: string | undefined) {
  if (!status) {
    return ProductStatus.ACTIVE;
  }

  if (PRODUCT_STATUS_VALUES.has(status)) {
    return status as ProductStatus;
  }

  return ProductStatus.ACTIVE;
}

export function parseOrderStatus(status: string | undefined) {
  if (!status) {
    return null;
  }

  if (ORDER_STATUS_VALUES.has(status)) {
    return status as OrderStatus;
  }

  return null;
}

export function parseShipmentStatus(status: string | undefined) {
  if (!status) {
    return null;
  }

  if (SHIPMENT_STATUS_VALUES.has(status)) {
    return status as ShipmentStatus;
  }

  return null;
}
