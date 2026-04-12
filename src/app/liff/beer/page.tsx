"use client";

import { drinkCooldownRemainingSec } from "@/lib/drink-rules";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { AlertTriangle, Beer, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type LiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
};

type DrinkStateResponse = {
  status: string;
  bookingCode: string | null;
  drinkCount: number;
  drinkLastAt: string | null;
  drinkCooldownSec: number;
  drinkMaxPerUser: number;
  cooldownRemainingSec: number;
  atMax: boolean;
  canAdd: boolean;
  nickname?: string;
  message?: string;
};

const LIFF_PROFILE_STORAGE_KEY = "alexcraft:liffProfile";
const LIFF_PROFILE_TTL_MS = 1000 * 60 * 60 * 12;

type CachedLiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
  savedAtMs: number;
  expiresAtMs: number;
};

export default function LiffBeerPage() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);
  const [drink, setDrink] = useState<DrinkStateResponse | null>(null);
  const [loadingDrink, setLoadingDrink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const loadDrink = useCallback(async (lineUserId: string) => {
    setLoadingDrink(true);
    setError("");
    try {
      const response = await fetch(`/api/liff/drink?lineUserId=${encodeURIComponent(lineUserId)}`);
      const data = (await response.json()) as DrinkStateResponse & { message?: string };
      if (!response.ok) {
        setDrink(null);
        setError(data.message ?? "โหลดข้อมูลเติมแก้วไม่สำเร็จ");
        return;
      }
      setDrink(data);
    } catch {
      setDrink(null);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoadingDrink(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    void loadDrink(profile.lineUserId);
  }, [profile?.lineUserId, loadDrink]);

  const liveCooldownSec = useMemo(() => {
    if (!drink) return 0;
    if (drink.drinkCooldownSec <= 0) return 0;
    return drinkCooldownRemainingSec(
      drink.drinkLastAt ? new Date(drink.drinkLastAt) : null,
      drink.drinkCooldownSec
    );
  }, [drink, tick]);

  const canTap = Boolean(
    drink && drink.status === "checked_in" && !drink.atMax && liveCooldownSec === 0 && !submitting && !loadingDrink
  );

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const response = await fetch("/api/liff/login/start?redirectTo=/liff/beer");
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

  async function onAddOne() {
    if (!profile?.lineUserId || !canTap) return;
    setSubmitting(true);
    setToast("");
    setError("");
    try {
      const response = await fetch("/api/liff/drink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.lineUserId })
      });
      const data = (await response.json()) as DrinkStateResponse & { message?: string; code?: string };
      if (!response.ok) {
        setError(data.message ?? "บันทึกไม่สำเร็จ");
        await loadDrink(profile.lineUserId);
        return;
      }
      setToast(data.message ?? "บันทึกแล้ว");
      await loadDrink(profile.lineUserId);
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างบันทึก");
    } finally {
      setSubmitting(false);
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
            <h2 className="text-xl font-semibold text-[var(--brand)]">เติมพลัง (เบียร์)</h2>
            <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE เพื่อบันทึกแก้ว</p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              disabled={startingLogin}
              className="mt-5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {startingLogin ? "กำลังพาไป LINE Login..." : "Login with LINE"}
            </button>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <Link
              href="/liff/status"
              className="mt-6 inline-block text-sm text-zinc-500 underline underline-offset-2"
            >
              กลับไปดูสถานะ
            </Link>
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
          <h1 className="mb-4 text-center text-lg font-semibold text-zinc-950 sm:text-xl">เติมพลัง (เบียร์)</h1>
          <div className="mb-4 flex flex-col items-center text-center">
            {profile?.pictureUrl ? (
              <img
                src={liffProfileImageSrc(profile.pictureUrl) || ""}
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

          {loadingDrink && !drink ? (
            <p className="text-center text-sm text-zinc-600">กำลังโหลด...</p>
          ) : drink ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">แก้วที่บันทึกในงาน</p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-amber-950">{drink.drinkCount}</p>
                <p className="mt-1 text-xs text-amber-900/85">คูลดาวน์ {drink.drinkCooldownSec} วินาที</p>
              </div>

              {drink.status !== "checked_in" ? (
                <p className="mt-4 text-center text-sm text-zinc-600">
                  ใช้งานได้หลังเช็คอินเข้างานแล้ว — สถานะปัจจุบัน: {drink.status}
                </p>
              ) : drink.atMax ? (
                <p className="mt-4 text-center text-sm font-medium text-red-700">ถึงเพดานแก้วแล้ว</p>
              ) : liveCooldownSec > 0 ? (
                <p className="mt-4 text-center text-sm text-zinc-700">
                  รอคูลดาวน์อีก{" "}
                  <span className="font-mono font-semibold tabular-nums">{liveCooldownSec}</span> วินาที
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void onAddOne()}
                disabled={!canTap}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-4 text-base font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
                {submitting ? "กำลังบันทึก..." : "เติม +1 แก้ว"}
              </button>
            </>
          ) : null}

          {error ? (
            <p className="mt-4 inline-flex items-center justify-center gap-2 text-center text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {toast ? <p className="mt-3 text-center text-sm text-emerald-700">{toast}</p> : null}
        </section>

        <p className="mx-auto mt-4 max-w-sm text-center text-sm font-medium text-zinc-300">
          กดเติมได้ทีละ 1 แก้วต่อครั้ง
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/liff/status"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            <Beer className="h-4 w-4" />
            กลับไปดูสถานะ
          </Link>
        </div>
      </div>
    </main>
  );
}
