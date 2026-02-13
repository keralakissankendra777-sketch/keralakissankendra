-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PotSizeCode') THEN
    CREATE TYPE "PotSizeCode" AS ENUM ('S', 'M', 'L', 'CUSTOM');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductVariation" (
  "id" TEXT NOT NULL,
  "sizeCode" "PotSizeCode" NOT NULL,
  "customSizeLabel" TEXT,
  "label" TEXT NOT NULL,
  "priceInr" INTEGER NOT NULL,
  "stock" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id")
);

-- Add columns
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "variationId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variationId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variationLabel" TEXT NOT NULL DEFAULT '';

-- Backfill one variation per product for existing rows
INSERT INTO "ProductVariation" (
  "id",
  "sizeCode",
  "customSizeLabel",
  "label",
  "priceInr",
  "stock",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "productId"
)
SELECT
  CONCAT('var_', p."id"),
  CASE
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('s', 'small') THEN 'S'::"PotSizeCode"
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('m', 'medium') THEN 'M'::"PotSizeCode"
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('l', 'large') THEN 'L'::"PotSizeCode"
    ELSE 'CUSTOM'::"PotSizeCode"
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('s', 'small', 'm', 'medium', 'l', 'large') THEN NULL
    ELSE NULLIF(TRIM(COALESCE(p."potSize", '')), '')
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('s', 'small') THEN 'Small'
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('m', 'medium') THEN 'Medium'
    WHEN LOWER(TRIM(COALESCE(p."potSize", ''))) IN ('l', 'large') THEN 'Large'
    ELSE COALESCE(NULLIF(TRIM(COALESCE(p."potSize", '')), ''), 'Custom')
  END,
  p."priceInr",
  p."stock",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  p."id"
FROM "Product" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductVariation" pv WHERE pv."productId" = p."id"
);

-- Attach existing cart/order rows to first variation of the product
UPDATE "CartItem" c
SET "variationId" = (
  SELECT pv."id"
  FROM "ProductVariation" pv
  WHERE pv."productId" = c."productId"
  ORDER BY pv."sortOrder" ASC, pv."createdAt" ASC
  LIMIT 1
)
WHERE c."variationId" IS NULL;

UPDATE "OrderItem" oi
SET
  "variationId" = (
    SELECT pv."id"
    FROM "ProductVariation" pv
    WHERE pv."productId" = oi."productId"
    ORDER BY pv."sortOrder" ASC, pv."createdAt" ASC
    LIMIT 1
  ),
  "variationLabel" = COALESCE(
    (
      SELECT pv."label"
      FROM "ProductVariation" pv
      WHERE pv."productId" = oi."productId"
      ORDER BY pv."sortOrder" ASC, pv."createdAt" ASC
      LIMIT 1
    ),
    oi."variationLabel"
  )
WHERE oi."variationId" IS NULL;

-- Enforce non-null
ALTER TABLE "CartItem" ALTER COLUMN "variationId" SET NOT NULL;

-- Replace cart uniqueness (product-level -> variation-level)
DROP INDEX IF EXISTS "CartItem_profileId_productId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_profileId_variationId_key" ON "CartItem"("profileId", "variationId");

-- Indexes
CREATE INDEX IF NOT EXISTS "ProductVariation_productId_idx" ON "ProductVariation"("productId");
CREATE INDEX IF NOT EXISTS "ProductVariation_sizeCode_idx" ON "ProductVariation"("sizeCode");
CREATE INDEX IF NOT EXISTS "ProductVariation_label_idx" ON "ProductVariation"("label");
CREATE INDEX IF NOT EXISTS "CartItem_variationId_idx" ON "CartItem"("variationId");
CREATE INDEX IF NOT EXISTS "OrderItem_variationId_idx" ON "OrderItem"("variationId");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductVariation_productId_fkey'
  ) THEN
    ALTER TABLE "ProductVariation"
    ADD CONSTRAINT "ProductVariation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CartItem_variationId_fkey'
  ) THEN
    ALTER TABLE "CartItem"
    ADD CONSTRAINT "CartItem_variationId_fkey"
    FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrderItem_variationId_fkey'
  ) THEN
    ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_variationId_fkey"
    FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
