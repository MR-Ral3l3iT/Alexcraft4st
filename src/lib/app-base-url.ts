/** Public base URL for server-side links (QR, redirects). Prefer https in production so LINE can fetch images. */
export function getServerAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw.replace(/\/$/, "");
    return `https://${raw.replace(/\/$/, "")}`;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}
