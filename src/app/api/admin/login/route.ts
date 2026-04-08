import { prisma } from "@/lib/prisma";
import { signAdminSession, getAdminSessionCookieName } from "@/lib/security/auth";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = sanitizeText(body.email, 120).toLowerCase();
  const password = sanitizeText(body.password, 120);

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const adminPassword = process.env.ADMIN_PASSWORD || "admin1234";

  if (!admin || password !== adminPassword) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const token = signAdminSession(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return response;
}
