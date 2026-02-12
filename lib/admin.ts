import { OrderStatus, ProductStatus } from "@prisma/client";

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

  if (status in ProductStatus) {
    return status as ProductStatus;
  }

  return ProductStatus.ACTIVE;
}

export function parseOrderStatus(status: string | undefined) {
  if (!status) {
    return null;
  }

  if (status in OrderStatus) {
    return status as OrderStatus;
  }

  return null;
}
