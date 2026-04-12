#!/usr/bin/env node
/**
 * ลบข้อมูลผู้ใช้งาน (การจอง) ทั้งหมดเพื่อลอง flow ใหม่จากต้น
 * - ลบ Booking ทุกแถว → CheckinLog / BookingStatusLog ถูกลบตาม onDelete: Cascade
 * - ไม่ลบ AdminUser, EventSettings
 *
 * รัน: node scripts/db/reset-user-flow.mjs --yes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function loadDotEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  const ok = process.argv.includes("--yes");
  if (!ok) {
    console.error("คำสั่งนี้จะลบการจองทั้งหมดในฐานข้อมูล");
    console.error("รันอีกครั้งพร้อม --yes เพื่อยืนยัน:");
    console.error("  node scripts/db/reset-user-flow.mjs --yes");
    process.exit(1);
  }

  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    console.error("ไม่พบ DATABASE_URL (.env)");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const deleted = await prisma.booking.deleteMany({});
    console.log(`ลบ Booking แล้ว ${deleted.count} แถว`);
    console.log("(CheckinLog / BookingStatusLog ลบตาม cascade — AdminUser / EventSettings ไม่ถูกลบ)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
