-- AlterTable
ALTER TABLE "Industry" ADD COLUMN     "faq" JSONB DEFAULT '[]',
ADD COLUMN     "relatedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
