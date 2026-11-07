-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "certifications" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "minCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pricingMethod" TEXT NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitLabel" TEXT;

-- CreateTable
CREATE TABLE "InstrumentDocument" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstrumentDocument" ADD CONSTRAINT "InstrumentDocument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
