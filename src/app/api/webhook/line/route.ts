import { verifyLineSignature } from "@/lib/line";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`line:webhook:${ip}`, 120, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const signature = request.headers.get("x-line-signature");
  const rawBody = await request.text();
  const valid = verifyLineSignature(rawBody, signature);
  if (!valid) {
    auditLog("warn", "line_webhook_invalid_signature", { ip });
    return NextResponse.json({ message: "Invalid LINE signature" }, { status: 401 });
  }

  let body: { events?: unknown[] } = {};
  try {
    body = JSON.parse(rawBody) as { events?: unknown[] };
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
  }

  // You can plug event handlers here for follow/unfollow/message/etc.

  return NextResponse.json({
    ok: true,
    receivedEvents: Array.isArray(body?.events) ? body.events.length : 0
  });
}
