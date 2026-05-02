#!/usr/bin/env node
/**
 * จำลองผู้เช็คอินหลายคนไปหน้าจอ TV / แผนที่งาน (Socket.IO) — ไม่เขียน DB
 *
 * เงื่อนไข API:
 * - NODE_ENV=development (npm run dev) หรือ DISPLAY_SIMULATE_CHECKIN=true
 * - DISPLAY_TV_TOKEN เดียวกับหน้า /display/checkin-map?token=...
 *
 * การใช้:
 *   npm run display:simulate-crowd -- --count 25
 *   (อ่าน DISPLAY_TV_TOKEN จาก .env / .env.local ในรากโปรเจกต์ — ค่าที่ export ใน shell จะได้ก่อน)
 *
 * ตัวเลือก:
 *   --count N       จำนวนครั้งที่ยิง simulate (default 15)
 *   --delay-ms N    ห่างแต่ละครั้งมิลลิวินาที (default 100)
 *   --high-drinks P โอกาสเป็นเปอร์เซ็นต์ที่ใส่ drinkCount > 6 (โหมด super) default 35
 *   --base-url URL  default http://localhost:3000
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Next.js โหลด .env ให้ตอนรันแอป — สคริปต์ Node ต้องอ่านเอง
 * ลำดับ: รวม .env แล้ว .env.local ทับคีย์เดียวกัน; ค่าที่ตั้งใน shell ไม่ถูกทับ
 */
function loadDotEnvFromProjectRoot() {
  const cwd = process.cwd();
  const merged = {};
  for (const name of [".env", ".env.local"]) {
    const p = resolve(cwd, name);
    if (!existsSync(p)) continue;
    let text = readFileSync(p, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const noExport = t.replace(/^export\s+/i, "");
      const eq = noExport.indexOf("=");
      if (eq <= 0) continue;
      const key = noExport.slice(0, eq).trim();
      let val = noExport.slice(eq + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      } else {
        const hash = val.search(/\s+#/);
        if (hash !== -1) val = val.slice(0, hash).trim();
      }
      merged[key] = val;
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnvFromProjectRoot();

const BASE_URL_DEFAULT = "http://localhost:3000";

const FIRST_NAMES = [
  "แอม",
  "บีม",
  "ซี",
  "ดิว",
  "อาร์ม",
  "พลอย",
  "มิ้น",
  "เต้",
  "หยก",
  "นิว",
  "มาย",
  "จูน",
  "บอส",
  "ณิชา",
  "วิน"
];

function parseArgs(argv) {
  let count = 15;
  let delayMs = 100;
  let highDrinksPct = 35;
  let baseUrl = process.env.BASE_URL?.trim() || BASE_URL_DEFAULT;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count" && argv[i + 1]) {
      count = Math.max(1, parseInt(argv[++i], 10) || 15);
    } else if (a === "--delay-ms" && argv[i + 1]) {
      delayMs = Math.max(0, parseInt(argv[++i], 10) || 100);
    } else if (a === "--high-drinks" && argv[i + 1]) {
      highDrinksPct = Math.min(100, Math.max(0, parseInt(argv[++i], 10) || 35));
    } else if (a === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i].trim();
    } else if (a === "--help" || a === "-h") {
      console.log(`
simulate-map-crowd — จำลองคนเดินบนแผนที่ (ผ่าน /api/display/simulate-checkin)

ตัวแปรแวดล้อม:
  DISPLAY_TV_TOKEN  (จำเป็น) โทเคนเดียวกับหน้า display
  BASE_URL          (ทางเลือก) default ${BASE_URL_DEFAULT}

ตัวเลือก:
  --count N
  --delay-ms N
  --high-drinks P   0–100 เปอร์เซ็นต์ที่สุ่มแก้ว > 6
  --base-url URL

ตัวอย่าง:
  DISPLAY_TV_TOKEN=tv-secret node scripts/display/simulate-map-crowd.mjs --count 30 --delay-ms 80
`);
      process.exit(0);
    }
  }

  return { count, delayMs, highDrinksPct, baseUrl };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDrinkCount(highDrinksPct) {
  if (Math.random() * 100 < highDrinksPct) {
    return 7 + Math.floor(Math.random() * 4);
  }
  return Math.floor(Math.random() * 7);
}

function displayName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  return `ทดสอบ ${first} #${index + 1}`;
}

async function simulateOne(baseUrl, token, index, highDrinksPct) {
  const url = new URL("/api/display/simulate-checkin", baseUrl.replace(/\/$/, ""));
  url.searchParams.set("token", token);

  const body = {
    fullName: displayName(index),
    drinkCount: randomDrinkCount(highDrinksPct),
    source: "self",
    pictureUrl: null
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.message || text || res.statusText;
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  return json;
}

async function main() {
  const token = process.env.DISPLAY_TV_TOKEN?.trim();
  if (!token) {
    console.error("❌ ไม่พบ DISPLAY_TV_TOKEN");
    console.error("   ใส่ใน .env หรือ .env.local ที่รากโปรเจกต์ หรือ export ก่อนรันสคริปต์");
    console.error("   รันคำสั่งจากโฟลเดอร์โปรเจกต์ (ที่มีไฟล์ .env)");
    process.exit(1);
  }

  const { count, delayMs, highDrinksPct, baseUrl } = parseArgs(process.argv.slice(2));

  console.log(`→ Base: ${baseUrl}`);
  console.log(`→ จำลอง ${count} คน, ห่าง ${delayMs} ms, แก้วสูง ~${highDrinksPct}%`);
  console.log(`→ เปิดหน้าแผนที่พร้อม token แล้วรอ Socket…\n`);

  let ok = 0;
  for (let i = 0; i < count; i++) {
    try {
      const out = await simulateOne(baseUrl, token, i, highDrinksPct);
      const name = out?.payload?.fullName ?? displayName(i);
      ok++;
      console.log(`  [${i + 1}/${count}] OK — ${name} (แก้ว ${out?.payload?.drinkCount ?? "?"})`);
    } catch (e) {
      console.error(`  [${i + 1}/${count}] FAIL —`, e instanceof Error ? e.message : e);
      if (String(e?.message || e).includes("403")) {
        console.error("\n  💡 เปิด simulate ได้เมื่อ NODE_ENV=development หรือ DISPLAY_SIMULATE_CHECKIN=true");
      }
      process.exitCode = 1;
      break;
    }
    if (delayMs > 0 && i < count - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`\nเสร็จแล้ว: สำเร็จ ${ok}/${count}`);
}

main();
