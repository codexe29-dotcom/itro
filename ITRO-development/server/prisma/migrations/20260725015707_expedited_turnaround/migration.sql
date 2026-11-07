-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "rushDays" INTEGER,
ADD COLUMN     "rushSurchargePct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "expedited" BOOLEAN NOT NULL DEFAULT false;
