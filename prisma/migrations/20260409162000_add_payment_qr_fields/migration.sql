-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "paymentAmount" INTEGER,
ADD COLUMN "paymentRef" TEXT,
ADD COLUMN "paymentQrPayload" TEXT,
ADD COLUMN "paymentQrImageUrl" TEXT,
ADD COLUMN "paymentRequestedAt" TIMESTAMP(3),
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentRef_key" ON "Booking"("paymentRef");
