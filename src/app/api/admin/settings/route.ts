import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type PatchBody = {
  capacity?: number;
  venueLat?: number | null;
  venueLng?: number | null;
  checkinRadiusM?: number;
  checkinStartAt?: string | null;
  checkinEndAt?: string | null;
  drinkCooldownSec?: number;
  drinkMaxPerUser?: number;
  paymentAmountThb?: number;
  paymentAccountNo?: string | null;
  paymentBankName?: string | null;
  paymentAccountName?: string | null;
};

function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const value = sanitizeText(input, 60);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET() {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return NextResponse.json({ message: "Event settings not found" }, { status: 404 });
  }
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`admin:settings:patch:${ip}`, 30, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as PatchBody;
  const capacity = Number(body.capacity);
  const checkinRadiusM = Number(body.checkinRadiusM);
  const drinkCooldownSec = Number(body.drinkCooldownSec);
  const drinkMaxPerUser = Number(body.drinkMaxPerUser);
  const paymentAmountThb = Number(body.paymentAmountThb);
  const paymentAccountNo = sanitizeText(body.paymentAccountNo, 50) || null;
  const paymentBankName = sanitizeText(body.paymentBankName, 80) || null;
  const paymentAccountName = sanitizeText(body.paymentAccountName, 120) || null;
  const venueLat = body.venueLat === null || body.venueLat === undefined ? null : Number(body.venueLat);
  const venueLng = body.venueLng === null || body.venueLng === undefined ? null : Number(body.venueLng);
  const checkinStartAt = parseDate(body.checkinStartAt);
  const checkinEndAt = parseDate(body.checkinEndAt);

  if (!Number.isFinite(capacity) || capacity < 1) {
    return NextResponse.json({ message: "Invalid capacity" }, { status: 400 });
  }
  if (!Number.isFinite(checkinRadiusM) || checkinRadiusM < 10 || checkinRadiusM > 5000) {
    return NextResponse.json({ message: "Invalid check-in radius" }, { status: 400 });
  }
  if (!Number.isFinite(drinkCooldownSec) || drinkCooldownSec < 0) {
    return NextResponse.json({ message: "Invalid drink cooldown" }, { status: 400 });
  }
  if (!Number.isFinite(drinkMaxPerUser) || drinkMaxPerUser < 0) {
    return NextResponse.json({ message: "Invalid drink max per user" }, { status: 400 });
  }
  if (!Number.isFinite(paymentAmountThb) || paymentAmountThb < 0) {
    return NextResponse.json({ message: "Invalid payment amount" }, { status: 400 });
  }
  if (venueLat !== null && (!Number.isFinite(venueLat) || venueLat < -90 || venueLat > 90)) {
    return NextResponse.json({ message: "Invalid venue latitude" }, { status: 400 });
  }
  if (venueLng !== null && (!Number.isFinite(venueLng) || venueLng < -180 || venueLng > 180)) {
    return NextResponse.json({ message: "Invalid venue longitude" }, { status: 400 });
  }
  if (checkinStartAt && checkinEndAt && checkinStartAt >= checkinEndAt) {
    return NextResponse.json({ message: "Check-in start time must be earlier than end time" }, { status: 400 });
  }

  const updated = await prisma.eventSettings.upsert({
    where: { id: 1 },
    update: {
      capacity,
      venueLat,
      venueLng,
      checkinRadiusM,
      checkinStartAt,
      checkinEndAt,
      drinkCooldownSec,
      drinkMaxPerUser,
      paymentAmountThb,
      paymentAccountNo,
      paymentBankName,
      paymentAccountName
    },
    create: {
      id: 1,
      capacity,
      venueLat,
      venueLng,
      checkinRadiusM,
      checkinStartAt,
      checkinEndAt,
      drinkCooldownSec,
      drinkMaxPerUser,
      paymentAmountThb,
      paymentAccountNo,
      paymentBankName,
      paymentAccountName
    }
  });

  return NextResponse.json(updated);
}
