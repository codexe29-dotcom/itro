-- CreateTable
CREATE TABLE "Accreditation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "certNumber" TEXT,
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accreditation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
