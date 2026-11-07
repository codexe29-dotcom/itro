-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "uptimePct" DOUBLE PRECISION;
