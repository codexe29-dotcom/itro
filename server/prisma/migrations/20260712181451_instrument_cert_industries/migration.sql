-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "accreditation" TEXT,
ADD COLUMN     "industries" TEXT[] DEFAULT ARRAY[]::TEXT[];
