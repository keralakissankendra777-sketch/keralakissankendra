-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShipmentStatus') THEN
    CREATE TYPE "ShipmentStatus" AS ENUM ('ORDER_RECEIVED', 'ITEM_PACKED', 'ITEM_SHIPPED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "shipmentStatus" "ShipmentStatus" NOT NULL DEFAULT 'ORDER_RECEIVED';
