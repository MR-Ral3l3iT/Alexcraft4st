#!/usr/bin/env node
/**
 * Re-link LINE rich menus for ALL bookings in DB based on their status.
 *
 * Use this after creating a NEW rich menu (e.g. updated location URL) and
 * updating RICH_MENU_ID_* env vars — to push the new menu to existing users.
 *
 * Status → env mapping (same as src/lib/line-richmenu.ts):
 *   pending                 → RICH_MENU_ID_PENDING
 *   waiting_payment_review  → RICH_MENU_ID_WAITING_PAYMENT (fallback PENDING)
 *   confirmed               → RICH_MENU_ID_CONFIRMED
 *   checked_in              → RICH_MENU_ID_CHECKED_IN
 *   cancelled               → RICH_MENU_ID_CANCELLED
 *
 * Usage:
 *   node scripts/line/relink-richmenu-by-status.mjs --dry-run
 *   node scripts/line/relink-richmenu-by-status.mjs --yes
 *   node scripts/line/relink-richmenu-by-status.mjs --yes --status pending
 *   node scripts/line/relink-richmenu-by-status.mjs --yes --status pending,confirmed
 *   node scripts/line/relink-richmenu-by-status.mjs --yes --concurrency 4
 *
 * Notes:
 * - Reads .env (uses DATABASE_URL + LINE_CHANNEL_ACCESS_TOKEN + RICH_MENU_ID_*).
 * - Throttles requests to avoid LINE rate limit (429). Default concurrency = 3.
 * - Uses upstream API; safe to re-run (idempotent per user).
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

function parseArgs(argv) {
  const out = { dryRun: false, yes: false, concurrency: 3, statuses: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--concurrency") out.concurrency = Math.max(1, Number(argv[++i] ?? 3) || 3);
    else if (a === "--status") {
      const v = (argv[++i] ?? "").trim();
      if (v) out.statuses = new Set(v.split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

function richMenuIdForStatus(status, env) {
  switch (status) {
    case "pending":
      return env.RICH_MENU_ID_PENDING || "";
    case "waiting_payment_review":
      return env.RICH_MENU_ID_WAITING_PAYMENT || env.RICH_MENU_ID_PENDING || "";
    case "confirmed":
      return env.RICH_MENU_ID_CONFIRMED || "";
    case "checked_in":
      return env.RICH_MENU_ID_CHECKED_IN || "";
    case "cancelled":
      return env.RICH_MENU_ID_CANCELLED || "";
    default:
      return "";
  }
}

async function linkUser(token, userId, richMenuId) {
  const res = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.ok) return { ok: true };
  const text = await res.text();
  return { ok: false, status: res.status, error: text };
}

async function runWithLimit(items, concurrency, worker) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  loadDotEnv();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN in .env");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  if (!args.dryRun && !args.yes) {
    console.error("Refusing to run without --yes. Use --dry-run to preview, then re-run with --yes.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const where = args.statuses
      ? { status: { in: Array.from(args.statuses) } }
      : {};
    const bookings = await prisma.booking.findMany({
      where,
      select: { id: true, lineUserId: true, status: true, bookingCode: true, fullName: true }
    });

    if (bookings.length === 0) {
      console.log("No bookings matched. Nothing to do.");
      return;
    }

    const planned = bookings.map((b) => ({
      ...b,
      richMenuId: richMenuIdForStatus(b.status, process.env)
    }));

    const skippedNoId = planned.filter((b) => !b.richMenuId);
    const targets = planned.filter((b) => !!b.richMenuId);

    console.log(`Total bookings: ${bookings.length}`);
    console.log(`Will link: ${targets.length}`);
    console.log(`Skipped (no RICH_MENU_ID_* configured for status): ${skippedNoId.length}`);

    if (skippedNoId.length > 0) {
      const counts = skippedNoId.reduce((m, b) => {
        m[b.status] = (m[b.status] ?? 0) + 1;
        return m;
      }, {});
      console.log("  reasons:", counts);
    }

    if (args.dryRun) {
      const sample = targets.slice(0, 10).map((b) => ({
        bookingCode: b.bookingCode,
        status: b.status,
        lineUserId: b.lineUserId,
        richMenuId: b.richMenuId
      }));
      console.log("Sample (first 10):", sample);
      console.log("Dry-run only. Re-run with --yes to apply.");
      return;
    }

    let okCount = 0;
    let failCount = 0;
    const failures = [];

    await runWithLimit(targets, args.concurrency, async (b) => {
      const result = await linkUser(token, b.lineUserId, b.richMenuId);
      if (result.ok) {
        okCount++;
        process.stdout.write(".");
      } else {
        failCount++;
        failures.push({
          lineUserId: b.lineUserId,
          status: b.status,
          richMenuId: b.richMenuId,
          httpStatus: result.status,
          error: result.error
        });
        process.stdout.write("x");
      }
    });

    process.stdout.write("\n");
    console.log(`Linked OK: ${okCount}`);
    console.log(`Failed:    ${failCount}`);
    if (failures.length > 0) {
      console.log("First 10 failures:");
      console.log(failures.slice(0, 10));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
