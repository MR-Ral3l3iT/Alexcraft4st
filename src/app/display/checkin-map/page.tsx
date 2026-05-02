import { timingSafeEqual } from "node:crypto";
import { CheckinMapClient } from "./CheckinMapClient";

function tokensMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function DisplayCheckinMapPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const secret = process.env.DISPLAY_TV_TOKEN?.trim();
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  if (!secret) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-zinc-300">
        <p className="max-w-md">ยังไม่ได้ตั้งค่า DISPLAY_TV_TOKEN บนเซิร์ฟเวอร์ — ไม่สามารถเปิดหน้าจอแสดงผลได้</p>
      </main>
    );
  }

  if (!tokensMatch(token, secret)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-zinc-300">
        <p className="max-w-md">ไม่สามารถเข้าหน้าจอแสดงผลได้ — token ไม่ถูกต้องหรือไม่ได้ส่งมา</p>
      </main>
    );
  }

  return (
    <main>
      <CheckinMapClient />
    </main>
  );
}
