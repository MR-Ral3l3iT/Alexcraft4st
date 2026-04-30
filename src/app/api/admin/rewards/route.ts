import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security/input";
import { rateLimit } from "@/lib/security/rate-limit";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function extFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function saveRewardImageFile(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("INVALID_FILE_TYPE");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "rewards");
  await mkdir(uploadDir, { recursive: true });
  const extension = extFromMimeType(file.type);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, Buffer.from(bytes));
  return `/uploads/rewards/${filename}`;
}

function parseDateInput(value: string): Date | null {
  const cleaned = sanitizeText(value, 80);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(request: NextRequest) {
  const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const pageSizeRaw = Number(request.nextUrl.searchParams.get("pageSize") ?? 10);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 && pageSizeRaw <= 100 ? pageSizeRaw : 10;

  const [rewards, total] = await Promise.all([
    prisma.reward.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.reward.count()
  ]);

  return NextResponse.json({ rewards, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`admin:rewards:post:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ message: "Invalid request format" }, { status: 400 });
  }

  const formData = await request.formData();
  const imageFiles = formData.getAll("imageFile");
  if (imageFiles.length > 1) {
    return NextResponse.json({ message: "อัปโหลดได้ครั้งละ 1 รูปเท่านั้น" }, { status: 400 });
  }
  const code = sanitizeText(formData.get("code"), 60).toUpperCase();
  const name = sanitizeText(formData.get("name"), 120);
  const rawType = sanitizeText(formData.get("type"), 20).toLowerCase();
  const quantity = Number(formData.get("quantity"));
  const couponStartRaw = sanitizeText(formData.get("couponStartAt"), 80);
  const couponEndRaw = sanitizeText(formData.get("couponEndAt"), 80);
  const imageFile = imageFiles[0] ?? null;

  if (!code) {
    return NextResponse.json({ message: "กรุณาระบุรหัสของรางวัล" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ message: "กรุณาระบุชื่อของรางวัล" }, { status: 400 });
  }
  if (rawType !== "general" && rawType !== "coupon") {
    return NextResponse.json({ message: "ประเภทของรางวัลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ message: "จำนวนต้องเป็นตัวเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป" }, { status: 400 });
  }
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ message: "กรุณาเลือกรูปรางวัล" }, { status: 400 });
  }

  const type = rawType;
  const couponStartAt = type === "coupon" ? parseDateInput(couponStartRaw) : null;
  const couponEndAt = type === "coupon" ? parseDateInput(couponEndRaw) : null;

  if (type === "coupon" && (!couponStartAt || !couponEndAt)) {
    return NextResponse.json({ message: "กรุณาระบุช่วงเวลาเริ่มต้นและสิ้นสุดของคูปอง" }, { status: 400 });
  }
  if (couponStartAt && couponEndAt && couponStartAt >= couponEndAt) {
    return NextResponse.json({ message: "เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด" }, { status: 400 });
  }

  const duplicate = await prisma.reward.findUnique({ where: { code } });
  if (duplicate) {
    return NextResponse.json({ message: "รหัสของรางวัลนี้มีอยู่แล้ว" }, { status: 409 });
  }

  let imageUrl = "";
  try {
    imageUrl = await saveRewardImageFile(imageFile);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_FILE_TYPE") {
      return NextResponse.json({ message: "รองรับเฉพาะไฟล์ JPG, PNG, WEBP" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
      return NextResponse.json({ message: "ขนาดไฟล์ต้องไม่เกิน 5MB" }, { status: 400 });
    }
    return NextResponse.json({ message: "ไม่สามารถบันทึกรูปของรางวัลได้" }, { status: 500 });
  }

  const reward = await prisma.reward.create({
    data: {
      code,
      name,
      type,
      quantity,
      imageUrl,
      couponStartAt,
      couponEndAt
    }
  });

  return NextResponse.json(reward, { status: 201 });
}
