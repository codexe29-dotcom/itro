-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceYears" INTEGER,
    "ratePeriod" TEXT NOT NULL DEFAULT 'HOURLY',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availability" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Expert" ADD CONSTRAINT "Expert_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
