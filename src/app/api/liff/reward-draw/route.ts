import { buildRewardDrawResultFlexMessage } from "@/lib/line-flex-reward-draw-result";
import { safePushFlexMessage } from "@/lib/line";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { createRewardDrawForMilestone, milestoneLevelFromQuery, type DrinkMilestoneLevel } from "@/lib/reward-draw";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type GetResponse = {
  hasDraw: boolean;
  won?: boolean;
  rewardName?: string | null;
  loseReason?: string | null;
  milestoneLevel: number;
  message?: string;
};

type PostResponse = GetResponse & {
  pushed?: boolean;
};

export async function GET(request: NextRequest) {
  const lineUserId = sanitizeText(request.nextUrl.searchParams.get("lineUserId") ?? "", 120);
  const milestone = milestoneLevelFromQuery(request.nextUrl.searchParams.get("milestone"));
  if (!lineUserId) {
    return NextResponse.json({ message: "ต้องระบุ lineUserId", code: "LINE_USER_REQUIRED" } satisfies PostResponse, {
      status: 400
    });
  }
  if (!milestone) {
    return NextResponse.json({ message: "milestone ไม่ถูกต้อง", code: "BAD_MILESTONE" } satisfies PostResponse, {
      status: 400
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { lineUserId },
    select: { id: true }
  });
  if (!booking) {
    return NextResponse.json({ message: "ไม่พบการจอง", code: "BOOKING_NOT_FOUND" } satisfies PostResponse, {
      status: 404
    });
  }

  const existing = await prisma.rewardDraw.findUnique({
    where: { bookingId_milestoneLevel: { bookingId: booking.id, milestoneLevel: milestone } }
  });

  if (!existing) {
    return NextResponse.json({
      hasDraw: false,
      milestoneLevel: milestone
    } satisfies GetResponse);
  }

  return NextResponse.json({
    hasDraw: true,
    won: existing.won,
    rewardName: existing.rewardName,
    loseReason: existing.loseReason,
    milestoneLevel: existing.milestoneLevel
  } satisfies GetResponse);
}

type PostBody = { lineUserId?: string; milestoneLevel?: number };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`liff:reward-draw:${ip}`, 30, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "เรียกบ่อยเกินไป กรุณารอสักครู่", code: "RATE_LIMIT" } satisfies PostResponse, {
      status: 429
    });
  }

  const body = (await request.json()) as PostBody;
  const lineUserId = sanitizeText(body.lineUserId ?? "", 120);
  const milestone = body.milestoneLevel as DrinkMilestoneLevel | undefined;
  if (!lineUserId) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ LINE", code: "LINE_USER_REQUIRED" } satisfies PostResponse, {
      status: 400
    });
  }
  if (milestone !== 1 && milestone !== 2 && milestone !== 3) {
    return NextResponse.json({ message: "milestone ไม่ถูกต้อง", code: "BAD_MILESTONE" } satisfies PostResponse, {
      status: 400
    });
  }

  try {
    const result = await createRewardDrawForMilestone({ lineUserId, milestoneLevel: milestone });

    let pushed = false;
    if (!result.alreadyExists) {
      const flex = buildRewardDrawResultFlexMessage({
        milestoneLevel: milestone,
        won: result.draw.won,
        rewardName: result.draw.rewardName,
        rewardImageUrl: result.draw.rewardImageUrl,
        loseReason: result.draw.loseReason
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Flex payload
      const push = await safePushFlexMessage(lineUserId, flex as Record<string, any>);
      pushed = push.ok;
      auditLog("info", "reward_draw_result_flex", {
        lineUserId,
        milestoneLevel: milestone,
        won: result.draw.won,
        flexOk: push.ok,
        ...(!push.ok && "reason" in push ? { flexReason: String((push as { reason?: unknown }).reason ?? "") } : {})
      });
    }

    return NextResponse.json({
      hasDraw: true,
      won: result.draw.won,
      rewardName: result.draw.rewardName,
      loseReason: result.draw.loseReason,
      milestoneLevel: milestone,
      pushed,
      message: result.alreadyExists ? "เปิดกล่องไปแล้วใน milestone นี้" : undefined
    } satisfies PostResponse);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ message: "ไม่พบการจอง", code: "BOOKING_NOT_FOUND" } satisfies PostResponse, {
        status: 404
      });
    }
    if (code === "MILESTONE_NOT_REACHED") {
      return NextResponse.json(
        { message: "ยังไม่ถึงเงื่อนไข milestone สำหรับการเปิดกล่อง", code: "MILESTONE_NOT_REACHED" } satisfies PostResponse,
        { status: 400 }
      );
    }

    auditLog("error", "reward_draw_failed", { lineUserId, milestoneLevel: milestone, code });
    return NextResponse.json({ message: "เปิดกล่องไม่สำเร็จ", code: "REWARD_DRAW_FAILED" } satisfies PostResponse, {
      status: 500
    });
  }
}
