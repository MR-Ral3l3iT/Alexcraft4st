import type { Prisma, Reward } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DrinkMilestoneLevel = 1 | 2 | 3;

export function minDrinksForMilestoneLevel(level: DrinkMilestoneLevel): number {
  if (level === 1) return 3;
  if (level === 2) return 6;
  return 10;
}

export function milestoneLevelFromQuery(raw: string | null): DrinkMilestoneLevel | null {
  const value = Number(raw);
  if (value === 1 || value === 2 || value === 3) return value;
  return null;
}

export function getRewardDrawWinProbability(): number {
  const raw = process.env.REWARD_DRAW_WIN_PROBABILITY?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return 0.3;
}

function getMilestoneBudgetWeights(): { w1: number; w2: number } {
  const raw = process.env.REWARD_DRAW_MILESTONE_SHARES?.trim();
  // Format: "0.6,0.3" (เหลืออีก 0.1 ถือเป็นส่วนที่หลุดไป milestone สุดท้าย/หรือทบตามของเหลือจริง)
  if (raw) {
    const parts = raw.split(",").map((part) => Number(part.trim()));
    const w1 = parts[0];
    const w2 = parts[1];
    if (Number.isFinite(w1) && Number.isFinite(w2) && w1 >= 0 && w2 >= 0 && w1 + w2 <= 1) {
      return { w1, w2 };
    }
  }
  return { w1: 0.6, w2: 0.3 };
}

function isCouponActive(reward: Pick<Reward, "type" | "couponStartAt" | "couponEndAt">, now: Date): boolean {
  if (reward.type !== "coupon") return true;
  if (!reward.couponStartAt || !reward.couponEndAt) return false;
  return reward.couponStartAt <= now && now <= reward.couponEndAt;
}

export function filterEligibleRewards(rewards: Reward[], now: Date): Reward[] {
  return rewards.filter((reward) => reward.quantity > 0 && isCouponActive(reward, now));
}

function weightedPickIndex(weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return -1;
  let threshold = Math.random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) return index;
  }
  return weights.length - 1;
}

export async function pickRewardAndDecrementStockTx(
  tx: Prisma.TransactionClient,
  candidates: Reward[],
  maxAttempts = 8
): Promise<Reward | null> {
  if (candidates.length === 0) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const refreshed = await tx.reward.findMany({
      where: { id: { in: candidates.map((reward) => reward.id) } }
    });
    const eligible = filterEligibleRewards(refreshed, new Date());
    if (eligible.length === 0) return null;

    const weights = eligible.map((reward) => reward.quantity);
    const pickedIndex = weightedPickIndex(weights);
    if (pickedIndex < 0) return null;

    const picked = eligible[pickedIndex];
    const updated = await tx.reward.updateMany({
      where: { id: picked.id, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } }
    });
    if (updated.count === 1) {
      return picked;
    }
  }

  return null;
}

export async function createRewardDrawForMilestone(input: {
  lineUserId: string;
  milestoneLevel: DrinkMilestoneLevel;
}): Promise<{
  draw: {
    id: string;
    won: boolean;
    rewardId: string | null;
    rewardName: string | null;
    rewardImageUrl: string | null;
    loseReason: string | null;
    createdAt: Date;
  };
  alreadyExists: boolean;
}> {
  const winProbability = getRewardDrawWinProbability();
  const minDrinks = minDrinksForMilestoneLevel(input.milestoneLevel);
  const now = new Date();
  const shares = getMilestoneBudgetWeights();

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { lineUserId: input.lineUserId },
      select: { id: true, drinkCount: true }
    });
    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }
    if (booking.drinkCount < minDrinks) {
      throw new Error("MILESTONE_NOT_REACHED");
    }

    const existing = await tx.rewardDraw.findUnique({
      where: { bookingId_milestoneLevel: { bookingId: booking.id, milestoneLevel: input.milestoneLevel } }
    });
    if (existing) {
      const reward = existing.rewardId
        ? await tx.reward.findUnique({
            where: { id: existing.rewardId },
            select: { imageUrl: true }
          })
        : null;

      return {
        alreadyExists: true,
        draw: {
          id: existing.id,
          won: existing.won,
          rewardId: existing.rewardId,
          rewardName: existing.rewardName,
          rewardImageUrl: reward?.imageUrl ?? null,
          loseReason: existing.loseReason,
          createdAt: existing.createdAt
        }
      };
    }

    const pool = await tx.reward.findMany({
      where: { quantity: { gt: 0 } }
    });
    const eligible = filterEligibleRewards(pool, now);

    let won = false;
    let rewardId: string | null = null;
    let rewardName: string | null = null;
    let rewardImageUrl: string | null = null;
    let loseReason: string | null = null;

    const totalStock = eligible.reduce((sum, reward) => sum + reward.quantity, 0);

    const winsByMilestone = await tx.rewardDraw.groupBy({
      by: ["milestoneLevel"],
      where: { won: true },
      _count: { _all: true }
    });

    const winsAt = (level: number) => winsByMilestone.find((row) => row.milestoneLevel === level)?._count._all ?? 0;
    const wins1 = winsAt(1);
    const wins2 = winsAt(2);
    const wins3 = winsAt(3);

    const target1 = Math.floor(totalStock * shares.w1);
    const target2 = Math.floor(totalStock * shares.w2);
    const target3 = Math.max(0, totalStock - target1 - target2);

    const leftover1 = Math.max(0, target1 - wins1);
    const leftover2 = Math.max(0, target2 - wins2);

    const pool3 = target3 + leftover1 + leftover2;
    const milestoneCapRemaining =
      input.milestoneLevel === 1
        ? Math.max(0, target1 - wins1)
        : input.milestoneLevel === 2
          ? Math.max(0, target2 - wins2 + leftover1)
          : Math.max(0, pool3 - wins3);

    if (eligible.length === 0 || totalStock <= 0) {
      loseReason = "NO_STOCK";
    } else if (milestoneCapRemaining <= 0) {
      loseReason = "MILESTONE_QUOTA_FULL";
    } else if (Math.random() >= winProbability) {
      loseReason = "PROBABILITY_MISS";
    } else {
      const picked = await pickRewardAndDecrementStockTx(tx, eligible);
      if (!picked) {
        loseReason = "OUT_OF_STOCK";
      } else {
        won = true;
        rewardId = picked.id;
        rewardName = picked.name;
        rewardImageUrl = picked.imageUrl;
      }
    }

    const created = await tx.rewardDraw.create({
      data: {
        bookingId: booking.id,
        lineUserId: input.lineUserId,
        milestoneLevel: input.milestoneLevel,
        won,
        rewardId,
        rewardName,
        loseReason,
        winProbability
      }
    });

    return {
      alreadyExists: false,
      draw: {
        id: created.id,
        won: created.won,
        rewardId: created.rewardId,
        rewardName: created.rewardName,
        rewardImageUrl,
        loseReason: created.loseReason,
        createdAt: created.createdAt
      }
    };
  });
}
