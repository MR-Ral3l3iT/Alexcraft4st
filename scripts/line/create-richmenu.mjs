#!/usr/bin/env node
/**
 * Create a LINE Rich Menu via Messaging API (POST /v2/bot/richmenu),
 * then upload the menu image (POST api-data.line.me/.../content).
 *
 * Image size + tap areas are chosen from the file dimensions (PNG/JPEG):
 * - 1200×405 → สองโซน 800+400 หรือสามโซน 400×3 เมื่อมี --mid
 * - 2500×843 → two equal columns 1250×843
 *
 * Default image path: public/images/richmenu/register-status-alexcraft.png
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

const DEFAULT_IMAGE = path.join(repoRoot, "public/images/richmenu/register-status-alexcraft.png");

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
  const out = { name: "", left: "", mid: "", right: "", image: "", chatBar: "เมนู", preset: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") out.name = argv[++i] ?? "";
    else if (a === "--left") out.left = argv[++i] ?? "";
    else if (a === "--mid") out.mid = argv[++i] ?? "";
    else if (a === "--right") out.right = argv[++i] ?? "";
    else if (a === "--image") out.image = argv[++i] ?? "";
    else if (a === "--chat-bar") out.chatBar = argv[++i] ?? out.chatBar;
    else if (a === "--preset") out.preset = (argv[++i] ?? "").toLowerCase();
  }
  return out;
}

/**
 * Rich Menu ใช้แอคชัน uri เท่านั้น — กดแล้วเปิด URL (ไม่ส่ง Flex จากเมนูได้)
 * ปุ่ม "เช็คอิน" ต้องชี้ไป LIFF `/liff/checkin` ไม่ใช่ `/liff/register`
 *
 * ลิงก์ LIFF ใช้รูปแบบ `https://liff.line.me/{id}?p=/liff/...` เพื่อให้ Next เปิด `GET /liff?p=...`
 * แล้ว client ส่งต่อไป `/liff/beer` ฯลฯ — แก้กรณี LINE LIFF Endpoint ตั้งเป็นหน้าเดียว (เช่น /liff/register)
 * ทำให้ path หลัง `liff.line.me/.../liff/beer` ถูกเมินและทุกโซนไปหน้าเดิม
 *
 * ตั้งค่า LIFF Endpoint URL ใน LINE Developers เป็น: `{APP_BASE_URL}/liff` (ไม่ใช่แค่ /liff/register)
 */
function liffDeepLink(liffId, appPath) {
  const u = new URL(`https://liff.line.me/${liffId}`);
  u.searchParams.set("p", appPath);
  return u.toString();
}

function applyPreset(preset, env) {
  const liffId = env.LIFF_ID?.trim();
  if (!liffId) {
    throw new Error("--preset ต้องการ LIFF_ID ใน .env");
  }
  const maps =
    env.RICH_MENU_CREATE_RIGHT_URI?.trim() ||
    env.RICH_MENU_MAPS_URL?.trim() ||
    "https://maps.google.com/?q=13.7563,100.5018";

  if (preset === "pending") {
    return {
      name: env.RICH_MENU_CREATE_NAME || "alexcraft-pending",
      left: liffDeepLink(liffId, "/liff/status"),
      mid: "",
      right: maps,
      image: env.RICH_MENU_CREATE_IMAGE || "public/images/richmenu/register-status-alexcraft.png",
      chatBar: "เมนู"
    };
  }
  if (preset === "confirmed") {
    return {
      name: env.RICH_MENU_CREATE_NAME || "alexcraft-confirmed",
      left: liffDeepLink(liffId, "/liff/checkin"),
      mid: "",
      right: maps,
      image: env.RICH_MENU_CREATE_IMAGE || "public/images/richmenu/checkin-status-alexcraft.png",
      chatBar: "เมนู"
    };
  }
  if (preset === "checked_in") {
    return {
      name: env.RICH_MENU_CREATE_NAME || "alexcraft-checked-in",
      left: liffDeepLink(liffId, "/liff/beer"),
      mid: liffDeepLink(liffId, "/liff/energy"),
      right: liffDeepLink(liffId, "/liff/checkout"),
      image: env.RICH_MENU_CREATE_IMAGE || "public/images/richmenu/energy-status-alexcraft.png",
      chatBar: "เมนู"
    };
  }
  throw new Error(`Unknown --preset "${preset}". Use: pending | confirmed | checked_in`);
}

/** @returns {{ width: number, height: number }} */
function readImageDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && len >= 8) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  throw new Error("Could not read image dimensions (use PNG or JPEG).");
}

/**
 * LINE supports fixed sizes; we map common project layouts.
 * @returns {{ size: { width: number, height: number }, areas: object[] }}
 */
/** 1200×405 แบบสองปุ่ม (800 + 400) */
function layout1200x405Two(leftUri, rightUri) {
  return {
    size: { width: 1200, height: 405 },
    areas: [
      {
        bounds: { x: 0, y: 0, width: 800, height: 405 },
        action: { type: "uri", uri: leftUri, label: "ซ้าย" }
      },
      {
        bounds: { x: 800, y: 0, width: 400, height: 405 },
        action: { type: "uri", uri: rightUri, label: "ขวา" }
      }
    ]
  };
}

/** 1200×405 แบบสามปุ่มเท่าๆ กัน (400 × 3) — รูป energy-status-alexcraft */
function layout1200x405Three(leftUri, midUri, rightUri) {
  return {
    size: { width: 1200, height: 405 },
    areas: [
      {
        bounds: { x: 0, y: 0, width: 400, height: 405 },
        action: { type: "uri", uri: leftUri, label: "เติมเบียร์" }
      },
      {
        bounds: { x: 400, y: 0, width: 400, height: 405 },
        action: { type: "uri", uri: midUri, label: "ระดับพลัง" }
      },
      {
        bounds: { x: 800, y: 0, width: 400, height: 405 },
        action: { type: "uri", uri: rightUri, label: "Check out" }
      }
    ]
  };
}

function layoutForImageSize(width, height, leftUri, midUri, rightUri) {
  if (width === 1200 && height === 405) {
    if (midUri) {
      return layout1200x405Three(leftUri, midUri, rightUri);
    }
    return layout1200x405Two(leftUri, rightUri);
  }
  if (width === 2500 && height === 843) {
    if (midUri) {
      throw new Error("2500×843 ยังรองรับแค่ 2 คอลัมน์ — ใช้รูป 1200×405 กับ --mid สำหรับ 3 โซน");
    }
    return {
      size: { width: 2500, height: 843 },
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: { type: "uri", uri: leftUri, label: "ซ้าย" }
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: { type: "uri", uri: rightUri, label: "ขวา" }
        }
      ]
    };
  }
  throw new Error(
    `Unsupported image size ${width}×${height}. Use 1200×405 (2 หรือ 3 โซน) หรือ 2500×843 (2 คอลัมน์).`
  );
}

function buildRichMenuBody({ name, chatBarText, size, areas }) {
  return {
    size,
    selected: false,
    name,
    chatBarText: chatBarText.slice(0, 14),
    areas
  };
}

function resolveImagePath(input) {
  if (!input) return DEFAULT_IMAGE;
  if (path.isAbsolute(input)) return input;
  return path.join(repoRoot, input);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`Create a LINE rich menu (two URI areas) via Messaging API.

Image → size & tap areas (auto from file):
  1200×405  → สองโซน 800+400 หรือสามโซน 400×3 เมื่อมี --mid
  2500×843  → two 1250×843 columns (ยังไม่รองรับ 3 โซน)

Usage:
  npm run line:richmenu:create -- --name pending-alexcraft \\
    --left "https://liff.line.me/..." \\
    --right "https://maps.google.com/?q=..." \\
    --image public/images/richmenu/register-status-alexcraft.png

  1200×405 แบบ 3 โซน (เติมเบียร์ / พลัง / checkout):
  npm run line:richmenu:create -- --left "..." --mid "..." --right "..." \\
    --image public/images/richmenu/energy-status-alexcraft.png

  Preset ใช้ลิงก์ LIFF แบบ ?p=/liff/... (ดูคอมเมนต์ liffDeepLink ในไฟล์นี้) — ตั้ง LIFF Endpoint ใน LINE Developers เป็น {APP_BASE_URL}/liff

Presets (อ่าน LIFF_ID จาก .env):
  npm run line:richmenu:create -- --preset pending
  npm run line:richmenu:create -- --preset confirmed
  npm run line:richmenu:create -- --preset checked_in
    → รูป energy-status-alexcraft.png + 3 โซน: เบียร์ / พลัง / checkout (ลิงก์ผ่าน /liff?p=...)

  --left / --mid / --right / --image / --name ยังใส่ทับค่า preset ได้

Default --image: public/images/richmenu/register-status-alexcraft.png

Env: LINE_CHANNEL_ACCESS_TOKEN (required), LIFF_ID (required สำหรับ --preset)
Optional: RICH_MENU_CREATE_NAME, RICH_MENU_CREATE_LEFT_URI, RICH_MENU_CREATE_MID_URI, RICH_MENU_CREATE_RIGHT_URI, RICH_MENU_MAPS_URL, RICH_MENU_CREATE_IMAGE`);
    process.exit(0);
  }

  loadDotEnv();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN (.env)");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  let presetDefaults = { name: "", left: "", mid: "", right: "", image: "", chatBar: "" };
  if (args.preset) {
    try {
      presetDefaults = applyPreset(args.preset, process.env);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  const name =
    args.name ||
    presetDefaults.name ||
    process.env.RICH_MENU_CREATE_NAME ||
    `alexcraft-menu-${new Date().toISOString().slice(0, 10)}`;
  const left =
    args.left ||
    presetDefaults.left ||
    process.env.RICH_MENU_CREATE_LEFT_URI ||
    process.env.LIFF_URL_STATUS ||
    "";
  const mid =
    args.mid ||
    presetDefaults.mid ||
    process.env.RICH_MENU_CREATE_MID_URI ||
    "";
  const right =
    args.right ||
    presetDefaults.right ||
    process.env.RICH_MENU_CREATE_RIGHT_URI ||
    process.env.RICH_MENU_MAPS_URL ||
    "";
  const imagePath = resolveImagePath(
    args.image || presetDefaults.image || process.env.RICH_MENU_CREATE_IMAGE || ""
  );

  if (mid) {
    if (!left || !mid || !right) {
      console.error("แบบ 3 โซน: ต้องมี --left, --mid และ --right (หรือ preset ที่กำหนดครบ)");
      process.exit(1);
    }
  } else if (!left || !right) {
    console.error(
      "Need --left and --right URLs (or RICH_MENU_CREATE_LEFT_URI / RICH_MENU_CREATE_RIGHT_URI in .env)."
    );
    process.exit(1);
  }
  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  let dimensions;
  let layout;
  try {
    dimensions = readImageDimensions(imagePath);
    layout = layoutForImageSize(dimensions.width, dimensions.height, left, mid, right);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const body = buildRichMenuBody({
    name,
    chatBarText: args.chatBar || presetDefaults.chatBar || "เมนู",
    size: layout.size,
    areas: layout.areas
  });

  console.log(
    `Using image ${path.relative(repoRoot, imagePath) || imagePath} (${dimensions.width}×${dimensions.height})`
  );

  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const createText = await createRes.text();
  if (!createRes.ok) {
    console.error("Create rich menu failed:", createRes.status, createText);
    process.exit(1);
  }

  let richMenuId;
  try {
    richMenuId = JSON.parse(createText).richMenuId;
  } catch {
    console.error("Unexpected response:", createText);
    process.exit(1);
  }

  const imageBuf = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";

  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType
    },
    body: imageBuf
  });

  if (!uploadRes.ok) {
    const uploadText = await uploadRes.text();
    console.error("Upload image failed:", uploadRes.status, uploadText);
    console.error("Rich menu was created; you can delete it in console or via API. richMenuId:", richMenuId);
    process.exit(1);
  }

  console.log("Rich menu created and image uploaded.");
  console.log("richMenuId:", richMenuId);
  console.log("");
  console.log("Add to .env (example):");
  const envKey =
    args.preset === "confirmed"
      ? "RICH_MENU_ID_CONFIRMED"
      : args.preset === "checked_in"
        ? "RICH_MENU_ID_CHECKED_IN"
        : args.preset === "pending"
          ? "RICH_MENU_ID_PENDING"
          : "RICH_MENU_ID_*";
  console.log(`${envKey}="${richMenuId}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
