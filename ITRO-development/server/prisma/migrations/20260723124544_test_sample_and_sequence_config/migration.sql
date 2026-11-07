-- AlterTable
ALTER TABLE "TestDefinition" ADD COLUMN     "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sampleDestructive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sampleReturned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "samplesRequired" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TestPackage" ADD COLUMN     "sampleFlow" TEXT NOT NULL DEFAULT 'PER_TEST';

-- AlterTable
ALTER TABLE "TestPackageItem" ADD COLUMN     "dependsOnTestId" TEXT;
