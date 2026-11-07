-- Reconcile the committed migration history with the current Prisma schema.
-- Adds missing tables, columns, indexes, and relations without dropping data.

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "facilityId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'WORKSHOP',
    "mode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "location" TEXT,
    "onlineUrl" TEXT,
    "imageUrl" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "name" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" DOUBLE PRECISION NOT NULL,
    "funder" TEXT NOT NULL DEFAULT 'PLATFORM',
    "institutionId" TEXT,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDiscount" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perBuyerLimit" INTEGER NOT NULL DEFAULT 1,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceBundle" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "industryId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ServiceBundleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "funder" TEXT NOT NULL DEFAULT 'PLATFORM',
    "institutionId" TEXT,
    "orderId" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Booking" ADD COLUMN "paymentOrderId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentRef" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Facility" ADD COLUMN "accreditations" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Facility" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Facility" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Facility" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Facility" ADD COLUMN "inchargeName" TEXT;
ALTER TABLE "Instrument" ADD COLUMN "maxSampleSpec" JSONB;
ALTER TABLE "Instrument" ADD COLUMN "netTestHours" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "creditApplied" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "OrderDocument" ADD COLUMN "deliverable" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "emailFrom" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "razorpayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "razorpayKeyId" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "razorpayKeySecret" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "smtpPass" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "PlatformSetting" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "twilioFrom" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "twilioSid" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "twilioToken" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" ADD COLUMN "discountLabel" TEXT;
ALTER TABLE "Service" ADD COLUMN "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "Service" ADD COLUMN "intakeForms" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Service" ADD COLUMN "sampleDestructive" BOOLEAN;
ALTER TABLE "Service" ADD COLUMN "sampleRequirements" TEXT;
ALTER TABLE "Service" ADD COLUMN "sampleReturned" BOOLEAN;
ALTER TABLE "Service" ADD COLUMN "samplesRequired" INTEGER;
ALTER TABLE "ServiceOrder" ADD COLUMN "intakeAnswers" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ServiceOrder" ADD COLUMN "listPrice" DOUBLE PRECISION;
ALTER TABLE "TestDefinition" ADD COLUMN "conformanceRows" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TestDefinition" ADD COLUMN "fixturesRequired" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TestDefinition" ADD COLUMN "purpose" TEXT;
ALTER TABLE "TestDefinition" ADD COLUMN "severityNotes" TEXT;

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_institutionId_idx" ON "Event"("institutionId");
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_institutionId_idx" ON "Coupon"("institutionId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_buyerId_idx" ON "CouponRedemption"("buyerId");
CREATE UNIQUE INDEX "ServiceBundle_slug_key" ON "ServiceBundle"("slug");
CREATE INDEX "ServiceBundle_institutionId_idx" ON "ServiceBundle"("institutionId");
CREATE UNIQUE INDEX "ServiceBundleItem_bundleId_serviceId_key" ON "ServiceBundleItem"("bundleId", "serviceId");
CREATE INDEX "CreditEntry_buyerId_idx" ON "CreditEntry"("buyerId");
CREATE INDEX "CreditEntry_institutionId_idx" ON "CreditEntry"("institutionId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceBundleItem" ADD CONSTRAINT "ServiceBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ServiceBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceBundleItem" ADD CONSTRAINT "ServiceBundleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
