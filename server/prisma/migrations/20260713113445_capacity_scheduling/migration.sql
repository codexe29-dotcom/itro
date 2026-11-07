-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "capacityType" TEXT NOT NULL DEFAULT 'TIME_SLOT',
ADD COLUMN     "concurrency" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiresOperator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slotMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "throughputPerDay" INTEGER;

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityReservation" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "bookingId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "date" TIMESTAMP(3),
    "units" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityReservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityReservation" ADD CONSTRAINT "CapacityReservation_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityReservation" ADD CONSTRAINT "CapacityReservation_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityReservation" ADD CONSTRAINT "CapacityReservation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
