-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('general', 'coupon');

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RewardType" NOT NULL DEFAULT 'general',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT NOT NULL,
    "couponStartAt" TIMESTAMP(3),
    "couponEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reward_code_key" ON "Reward"("code");

-- CreateIndex
CREATE INDEX "Reward_type_idx" ON "Reward"("type");

-- CreateIndex
CREATE INDEX "Reward_createdAt_idx" ON "Reward"("createdAt");
