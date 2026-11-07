-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingNote" TEXT;

-- CreateTable
CREATE TABLE "OrderSample" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_SHIPMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSample_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderSample" ADD CONSTRAINT "OrderSample_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
