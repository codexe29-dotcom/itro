-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "applications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
