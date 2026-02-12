-- AlterTable
ALTER TABLE "Product" ADD COLUMN "potSize" TEXT NOT NULL DEFAULT 'Medium';

-- Ensure default categories exist (users can still add custom categories later)
INSERT INTO "Category" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT 'category_indoor', 'Indoor', 'indoor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'indoor');

INSERT INTO "Category" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT 'category_outdoor', 'Outdoor', 'outdoor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'outdoor');

-- CreateIndex
CREATE INDEX "Product_potSize_idx" ON "Product"("potSize");
