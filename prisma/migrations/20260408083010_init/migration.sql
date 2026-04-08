-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'waiting_payment_review', 'confirmed', 'cancelled', 'checked_in');

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "lineDisplay" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "slipUrl" TEXT,
    "bookingCode" TEXT,
    "qrCodePayload" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckinLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'qr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_lineUserId_key" ON "Booking"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingCode_key" ON "Booking"("bookingCode");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_phone_idx" ON "Booking"("phone");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "CheckinLog_bookingId_createdAt_idx" ON "CheckinLog"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckinLog_adminUserId_idx" ON "CheckinLog"("adminUserId");

-- CreateIndex
CREATE INDEX "BookingStatusLog_bookingId_createdAt_idx" ON "BookingStatusLog"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingStatusLog_toStatus_idx" ON "BookingStatusLog"("toStatus");

-- AddForeignKey
ALTER TABLE "CheckinLog" ADD CONSTRAINT "CheckinLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckinLog" ADD CONSTRAINT "CheckinLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusLog" ADD CONSTRAINT "BookingStatusLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusLog" ADD CONSTRAINT "BookingStatusLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
