import { canTransition } from "@/lib/booking-rules";
import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type SubmitSlipBody = {
  slipUrl?: string;
};

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const SLIP_UPLOAD_PREFIX = "/uploads/slips/";

function extFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function saveSlipFile(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("INVALID_FILE_TYPE");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "slips");
  await mkdir(uploadDir, { recursive: true });
  const extension = extFromMimeType(file.type);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, Buffer.from(bytes));
  return `/uploads/slips/${filename}`;
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function resolveSlipPath(slipUrl: string): string | null {
  if (!slipUrl.startsWith(SLIP_UPLOAD_PREFIX)) return null;
  const filename = path.basename(slipUrl);
  return path.join(process.cwd(), "public", "uploads", "slips", filename);
}

async function hashExistingSlipFile(slipUrl: string): Promise<string | null> {
  const absolutePath = resolveSlipPath(slipUrl);
  if (!absolutePath) return null;
  try {
    const fileBuffer = await readFile(absolutePath);
    return hashBuffer(fileBuffer);
  } catch {
    return null;
  }
}

async function removeExistingSlipFile(slipUrl: string): Promise<void> {
  const absolutePath = resolveSlipPath(slipUrl);
  if (!absolutePath) return;
  try {
    await unlink(absolutePath);
  } catch {
    // ignore if file already removed or unavailable
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:submit-slip:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { code: rawCode } = await context.params;
  const code = sanitizeText(rawCode, 120);
  const booking = await prisma.booking.findUnique({ where: { bookingCode: code } });
  if (!booking) {
    return NextResponse.json({ message: "Booking code not found" }, { status: 404 });
  }
  if (booking.status === "cancelled" || booking.status === "checked_in") {
    return NextResponse.json({ message: "Cannot submit slip for this booking status" }, { status: 400 });
  }

  let slipUrl = "";
  let shouldDeleteOldSlip = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("slipFile");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Slip file is required" }, { status: 400 });
    }
    const clientHash = sanitizeText(request.headers.get("x-slip-hash"), 128).toLowerCase();
    try {
      const incomingBytes = Buffer.from(await file.arrayBuffer());
      const incomingHash = clientHash || hashBuffer(incomingBytes);
      const existingHash = booking.slipUrl ? await hashExistingSlipFile(booking.slipUrl) : null;
      if (existingHash && existingHash === incomingHash) {
        return NextResponse.json({ message: "สลิปนี้เคยส่งแล้ว กรุณาแนบไฟล์ใหม่" }, { status: 409 });
      }

      slipUrl = await saveSlipFile(file);
      shouldDeleteOldSlip = !!booking.slipUrl && booking.slipUrl !== slipUrl;
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_FILE_TYPE") {
        return NextResponse.json({ message: "รองรับเฉพาะไฟล์ JPG, PNG, WEBP" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
        return NextResponse.json({ message: "ขนาดไฟล์ต้องไม่เกิน 5MB" }, { status: 400 });
      }
      return NextResponse.json({ message: "ไม่สามารถบันทึกไฟล์สลิปได้" }, { status: 500 });
    }
  } else {
    const body = (await request.json()) as SubmitSlipBody;
    slipUrl = sanitizeText(body.slipUrl, 500);
  }

  if (!slipUrl) {
    return NextResponse.json({ message: "Slip is required" }, { status: 400 });
  }

  if (booking.status === "pending") {
    if (!canTransition("pending", "waiting_payment_review")) {
      return NextResponse.json({ message: "Invalid status transition" }, { status: 400 });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        slipUrl,
        status: "waiting_payment_review"
      }
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: "waiting_payment_review",
        reason: "User submitted payment slip"
      }
    });
    await syncRichMenuByBookingStatus(updated.lineUserId, updated.status);
    if (shouldDeleteOldSlip && booking.slipUrl) {
      await removeExistingSlipFile(booking.slipUrl);
    }

    return NextResponse.json(updated);
  }

  // waiting_payment_review / confirmed: update slip only
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { slipUrl }
  });
  if (shouldDeleteOldSlip && booking.slipUrl) {
    await removeExistingSlipFile(booking.slipUrl);
  }
  return NextResponse.json(updated);
}
