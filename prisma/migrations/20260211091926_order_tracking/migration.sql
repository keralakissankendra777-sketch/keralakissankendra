-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingInstructions" TEXT,
ADD COLUMN     "shippingProvider" TEXT,
ADD COLUMN     "shippingTrackingId" TEXT,
ADD COLUMN     "shippingUrl" TEXT;
