"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/** เป้าหมายที่ Rich Menu / ลิงก์ LINE อนุญาตให้ส่งต่อได้ (กัน open redirect) */
const ALLOWED_LIFF_PATHS = new Set([
  "/liff/beer",
  "/liff/energy",
  "/liff/checkout",
  "/liff/checkin",
  "/liff/status",
  "/liff/register",
  "/liff/callback"
]);

/**
 * LINE อาจส่งส่วนที่ต่อท้าย LIFF URL มาเป็น `liff.state` แทน query `p` บน Endpoint
 * (ดู Primary redirect / liff.state ในเอกสาร Opening a LIFF app)
 */
function deepLinkPathFromSearchParams(sp: ReturnType<typeof useSearchParams>): string {
  const pDirect = sp.get("p")?.trim() ?? "";
  if (pDirect && ALLOWED_LIFF_PATHS.has(pDirect)) return pDirect;

  const liffStateRaw = sp.get("liff.state");
  if (!liffStateRaw) return "";

  let decoded = "";
  try {
    decoded = decodeURIComponent(liffStateRaw);
  } catch {
    return "";
  }

  const tryDecodeAgain =
    decoded.includes("%") && !decoded.startsWith("/")
      ? (() => {
          try {
            return decodeURIComponent(decoded);
          } catch {
            return decoded;
          }
        })()
      : decoded;

  const candidate = tryDecodeAgain.trim();
  if (ALLOWED_LIFF_PATHS.has(candidate)) return candidate;

  const pathHead = candidate.split(/[?#]/)[0]?.trim() ?? "";
  if (pathHead && ALLOWED_LIFF_PATHS.has(pathHead)) return pathHead;

  const qsSource = candidate.startsWith("?") ? candidate.slice(1) : candidate;
  try {
    const nested = new URLSearchParams(qsSource);
    const pNested = nested.get("p")?.trim() ?? "";
    if (pNested && ALLOWED_LIFF_PATHS.has(pNested)) return pNested;
  } catch {
    /* ignore */
  }

  return "";
}

function LiffEntryRedirect() {
  const sp = useSearchParams();
  const router = useRouter();
  const [hint, setHint] = useState("กำลังเปิด…");

  useEffect(() => {
    const p = deepLinkPathFromSearchParams(sp);
    if (p) {
      router.replace(p);
      return;
    }
    setHint("ไม่มีพารามิเตอร์ p — ไปหน้าลงทะเบียน (เหมือนเดิมเมื่อ Endpoint เคยชี้ /liff/register)");
    router.replace("/liff/register");
  }, [sp, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-zinc-100">
      <p className="text-sm text-zinc-400">{hint}</p>
    </main>
  );
}

export default function LiffEntryPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
          <p className="text-sm text-zinc-400">กำลังโหลด…</p>
        </main>
      }
    >
      <LiffEntryRedirect />
    </Suspense>
  );
}
