import { EVENT_CONFIG } from "@/config/event";
import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";

export type EffectiveEventSettings = {
  capacity: number;
  venueLat: number | null;
  venueLng: number | null;
  checkinRadiusM: number;
  checkinStartAt: Date | null;
  checkinEndAt: Date | null;
  drinkCooldownSec: number;
  drinkMaxPerUser: number;
  paymentAmountThb: number;
  paymentAccountNo: string | null;
  paymentBankName: string | null;
  paymentAccountName: string | null;
};

type EventSettingsDbClient = PrismaClient | Prisma.TransactionClient;

export async function getEffectiveEventSettings(db: EventSettingsDbClient = prisma): Promise<EffectiveEventSettings> {
  const row = await db.eventSettings.findUnique({ where: { id: 1 } });

  return {
    capacity: row?.capacity ?? EVENT_CONFIG.capacity,
    venueLat: row?.venueLat ?? EVENT_CONFIG.venueLat,
    venueLng: row?.venueLng ?? EVENT_CONFIG.venueLng,
    checkinRadiusM: row?.checkinRadiusM ?? EVENT_CONFIG.checkinRadiusM,
    checkinStartAt: row?.checkinStartAt ?? (EVENT_CONFIG.checkinStartAt ? new Date(EVENT_CONFIG.checkinStartAt) : null),
    checkinEndAt: row?.checkinEndAt ?? (EVENT_CONFIG.checkinEndAt ? new Date(EVENT_CONFIG.checkinEndAt) : null),
    drinkCooldownSec: row?.drinkCooldownSec ?? EVENT_CONFIG.drinkCooldownSec,
    drinkMaxPerUser: row?.drinkMaxPerUser ?? EVENT_CONFIG.drinkMaxPerUser,
    paymentAmountThb: row?.paymentAmountThb ?? Number(process.env.PAYMENT_PER_PERSON_THB ?? 799),
    paymentAccountNo: row?.paymentAccountNo ?? process.env.PAYMENT_ACCOUNT_NO ?? null,
    paymentBankName: row?.paymentBankName ?? process.env.PAYMENT_BANK_NAME ?? null,
    paymentAccountName: row?.paymentAccountName ?? process.env.PAYMENT_ACCOUNT_NAME ?? null
  };
}
