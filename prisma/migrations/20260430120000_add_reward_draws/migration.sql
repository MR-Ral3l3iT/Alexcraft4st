-- CreateTable
CREATE TABLE "RewardDraw" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "milestoneLevel" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,
    "rewardId" TEXT,
    "rewardName" TEXT,
    "loseReason" TEXT,
    "winProbability" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardDraw_bookingId_milestoneLevel_key" ON "RewardDraw"("bookingId", "milestoneLevel");

-- CreateIndex
CREATE INDEX "RewardDraw_lineUserId_milestoneLevel_idx" ON "RewardDraw"("lineUserId", "milestoneLevel");

-- CreateIndex
CREATE INDEX "RewardDraw_createdAt_idx" ON "RewardDraw"("createdAt");

-- AddForeignKey
ALTER TABLE "RewardDraw" ADD CONSTRAINT "RewardDraw_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDraw" ADD CONSTRAINT "RewardDraw_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
