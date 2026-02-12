-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressLine1" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "postalCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';
