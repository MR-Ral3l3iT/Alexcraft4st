-- CreateTable
CREATE TABLE "EventSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "venueLat" DOUBLE PRECISION,
    "venueLng" DOUBLE PRECISION,
    "checkinRadiusM" INTEGER NOT NULL DEFAULT 100,
    "checkinStartAt" TIMESTAMP(3),
    "checkinEndAt" TIMESTAMP(3),
    "drinkCooldownSec" INTEGER NOT NULL DEFAULT 600,
    "drinkMaxPerUser" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("id")
);
