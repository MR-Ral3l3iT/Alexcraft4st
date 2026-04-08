import crypto from "node:crypto";
import { ADMIN_SESSION_COOKIE } from "@/lib/security/constants";

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev-admin-secret";
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}

export function signAdminSession(email: string) {
  const payload = `${email}|${Date.now()}`;
  const mac = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${mac}`;
}

export function verifyAdminSession(value: string | undefined) {
  if (!value) return false;
  const parts = value.split("|");
  if (parts.length !== 3) return false;
  const [email, ts, mac] = parts;
  if (!email || !ts || !mac) return false;
  const payload = `${email}|${ts}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return expected === mac;
}
