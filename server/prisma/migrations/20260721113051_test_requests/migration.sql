-- CreateEnum
CREATE TYPE "TestRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TestRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "industryId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "standardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sampleRequirements" TEXT,
    "turnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "serviceId" TEXT,
    "status" "TestRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "createdTestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
