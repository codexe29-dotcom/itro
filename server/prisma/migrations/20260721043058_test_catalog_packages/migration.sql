-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "heroTagline" TEXT,
    "intro" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryStandard" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndustryStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "standardCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sampleRequirements" TEXT,
    "turnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "accreditation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestProcedureStep" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "TestProcedureStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestForm" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestProvider" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceOverride" DOUBLE PRECISION,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industryId" TEXT,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "pricingMode" TEXT NOT NULL DEFAULT 'DYNAMIC',
    "fixedPrice" DOUBLE PRECISION,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accreditation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssociatedTests" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Industry_slug_key" ON "Industry"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TestDefinition_slug_key" ON "TestDefinition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TestProvider_testId_serviceId_key" ON "TestProvider"("testId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "TestPackage_slug_key" ON "TestPackage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TestPackageItem_packageId_testId_key" ON "TestPackageItem"("packageId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "_AssociatedTests_AB_unique" ON "_AssociatedTests"("A", "B");

-- CreateIndex
CREATE INDEX "_AssociatedTests_B_index" ON "_AssociatedTests"("B");

-- AddForeignKey
ALTER TABLE "IndustryStandard" ADD CONSTRAINT "IndustryStandard_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDefinition" ADD CONSTRAINT "TestDefinition_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestProcedureStep" ADD CONSTRAINT "TestProcedureStep_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestForm" ADD CONSTRAINT "TestForm_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestProvider" ADD CONSTRAINT "TestProvider_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestProvider" ADD CONSTRAINT "TestProvider_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackage" ADD CONSTRAINT "TestPackage_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackageItem" ADD CONSTRAINT "TestPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TestPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackageItem" ADD CONSTRAINT "TestPackageItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssociatedTests" ADD CONSTRAINT "_AssociatedTests_A_fkey" FOREIGN KEY ("A") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssociatedTests" ADD CONSTRAINT "_AssociatedTests_B_fkey" FOREIGN KEY ("B") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
