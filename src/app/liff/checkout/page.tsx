"use client";

import { LogOut, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const LIFF_PROFILE_STORAGE_KEY = "alexcraft:liffProfile";
const LIFF_PROFILE_TTL_MS = 1000 * 60 * 60 * 12;

type LiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
};

type CachedLiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
  savedAtMs: number;
  expiresAtMs: number;
};

function LiffCheckoutPageContent() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const lineUserId = searchParams.get("lineUserId");
        const displayName = searchParams.get("displayName");
        const pictureUrl = searchParams.get("pictureUrl");

        if (!lineUserId || !displayName) {
          const raw = window.localStorage.getItem(LIFF_PROFILE_STORAGE_KEY);
          if (raw) {
            const cached = JSON.parse(raw) as CachedLiffProfile;
            const now = Date.now();
            if (cached?.lineUserId && cached?.displayName && cached.expiresAtMs > now) {
              setProfile({
                lineUserId: cached.lineUserId,
                displayName: cached.displayName,
                pictureUrl: cached.pictureUrl ?? null
              });
              return;
            }
            window.localStorage.removeItem(LIFF_PROFILE_STORAGE_KEY);
          }
        }

        const query = new URLSearchParams();
        if (lineUserId) query.set("lineUserId", lineUserId);
        if (displayName) query.set("displayName", displayName);
        if (pictureUrl) query.set("pictureUrl", pictureUrl);
        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await fetch(`/api/liff/profile${suffix}`);
        if (!response.ok) {
          setProfile(null);
          return;
        }
        const data = (await response.json()) as LiffProfile;
        setProfile(data);

        if (data.lineUserId && data.displayName) {
          const now = Date.now();
          const payload: CachedLiffProfile = {
            lineUserId: data.lineUserId,
            displayName: data.displayName,
            pictureUrl: data.pictureUrl ?? null,
            savedAtMs: now,
            expiresAtMs: now + LIFF_PROFILE_TTL_MS
          };
          window.localStorage.setItem(LIFF_PROFILE_STORAGE_KEY, JSON.stringify(payload));
        }
      } catch {
        setError("ไม่สามารถโหลดโปรไฟล์ได้");
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfile();
  }, [searchParams]);

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const response = await fetch("/api/liff/login/start?redirectTo=/liff/checkout");
      const data = (await response.json()) as { loginUrl?: string; message?: string };
      if (!response.ok || !data.loginUrl) {
        setError(data.message || "ไม่สามารถเริ่ม LINE Login ได้");
        return;
      }
      window.location.href = data.loginUrl;
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างเริ่ม LINE Login");
    } finally {
      setStartingLogin(false);
    }
  }

  async function onCheckout() {
    if (!profile?.lineUserId) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/bookings/self-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.lineUserId })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "เช็คเอาท์ไม่สำเร็จ");
        return;
      }
      setMessage(
        data.message
          ? `${data.message} — ตรวจสอบ Flex สรุปผลในแชท LINE จากบัญชีทางการ`
          : "เช็คเอาท์สำเร็จ — ตรวจสอบ Flex สรุปผลในแชท LINE"
      );
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างเช็คเอาท์");
    } finally {
      setLoading(false);
    }
  }

  if (!loadingProfile && !profile?.lineUserId) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center p-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
            <div className="mb-4 flex justify-center">
              <Image src="/alex-craft-logo.svg" alt="" width={92} height={92} className="h-auto" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--brand)]">Check out / กลับบ้าน</h2>
            <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE ก่อนเช็คเอาท์</p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              disabled={startingLogin}
              className="mt-5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {startingLogin ? "กำลังพาไป LINE Login..." : "Login with LINE"}
            </button>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <a href="/liff/status" className="mt-6 inline-block text-sm text-zinc-500 underline underline-offset-2">
              กลับไปดูสถานะ
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-md p-4 sm:p-6">
        <div className="mb-3 flex justify-end">
          <Image src="/alex-craft-logo.svg" alt="" width={34} height={34} className="h-auto" />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
          <h1 className="mb-4 text-center text-lg font-semibold text-zinc-950 sm:text-xl">Check out / กลับบ้าน</h1>

          <div className="mb-4 flex flex-col items-center text-center">
            {profile?.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- LINE profile URL
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                width={72}
                height={72}
                className="mb-2 h-[72px] w-[72px] rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xl font-semibold text-zinc-600">
                {(profile?.displayName || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-sm font-medium">{profile?.displayName}</p>
          </div>

          <p className="text-center text-sm text-zinc-600">
            เมื่อกดเช็คเอาท์ ระบบจะบันทึกเวลาออกจากงานและส่ง Flex สรุปผลคืนนี้ไปที่แชท LINE ของคุณ
          </p>

          <button
            type="button"
            onClick={() => void onCheckout()}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-4 text-base font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogOut className="h-5 w-5" />
            {loading ? "กำลังเช็คเอาท์..." : "เช็คเอาท์ / กลับบ้าน"}
          </button>
        </section>

        {message ? (
          <p className="mt-4 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-center text-sm text-emerald-100">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </p>
        ) : null}

        <div className="mt-6 flex justify-center">
          <a
            href="/liff/energy"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            กลับไปหน้าพลัง
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LiffCheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <LiffCheckoutPageContent />
    </Suspense>
  );
}
