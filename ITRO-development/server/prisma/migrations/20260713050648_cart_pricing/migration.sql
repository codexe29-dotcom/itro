-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('QUOTE', 'FIXED');

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "feeMode" TEXT,
ADD COLUMN     "feeValue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'QUOTE';

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "buyerAmount" DOUBLE PRECISION,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "platformFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "providerAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "feeMode" TEXT NOT NULL DEFAULT 'MARKUP_PERCENT',
    "feeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
