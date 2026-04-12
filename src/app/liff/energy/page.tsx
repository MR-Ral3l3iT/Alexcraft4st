"use client";

import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { AlertTriangle, Beer } from "lucide-react";
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
  drinkMaxPerUser: number;
  nickname: string;
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

const MASCOT_L1 = "/images/mascot-icon/FirstPour-alexcraft.png";
const MASCOT_L2 = "/images/mascot-icon/BuzzRider-alexcraft.png";
const MASCOT_L3 = "/images/mascot-icon/MidnightMaster-alexcraft.png";

function mascotSrcForDrinkCount(count: number): string {
  if (count < 6) return MASCOT_L1;
  if (count < 10) return MASCOT_L2;
  return MASCOT_L3;
}

export default function LiffEnergyPage() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);
  const [drink, setDrink] = useState<DrinkStateResponse | null>(null);
  const [loadingDrink, setLoadingDrink] = useState(false);
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

  const loadDrink = useCallback(async (lineUserId: string) => {
    setLoadingDrink(true);
    setError("");
    try {
      const response = await fetch(`/api/liff/drink?lineUserId=${encodeURIComponent(lineUserId)}`);
      const data = (await response.json()) as DrinkStateResponse & { message?: string };
      if (!response.ok) {
        setDrink(null);
        setError(data.message ?? "โหลดข้อมูลไม่สำเร็จ");
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

  const showLineProfileAvatar = useMemo(() => {
    if (!drink || drink.status !== "checked_in") return true;
    return drink.drinkCount < 3;
  }, [drink]);

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const response = await fetch("/api/liff/login/start?redirectTo=/liff/energy");
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

  if (!loadingProfile && !profile?.lineUserId) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center p-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
            <div className="mb-4 flex justify-center">
              <Image src="/alex-craft-logo.svg" alt="" width={92} height={92} className="h-auto" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--brand)]">ระดับพลังของฉัน</h2>
            <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE เพื่อดูฉายาและจำนวนแก้ว</p>
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
          <h1 className="mb-4 text-center text-lg font-semibold text-zinc-950 sm:text-xl">ระดับพลังของฉัน</h1>

          <div className="mb-5 flex flex-col items-center text-center">
            {profile ? (
              showLineProfileAvatar ? (
                profile.pictureUrl ? (
                  <img
                    src={liffProfileImageSrc(profile.pictureUrl) || ""}
                    alt={profile.displayName}
                    width={72}
                    height={72}
                    className="mb-2 h-[72px] w-[72px] rounded-full border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xl font-semibold text-zinc-600">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                )
              ) : drink ? (
                <Image
                  src={mascotSrcForDrinkCount(drink.drinkCount)}
                  alt={profile.displayName}
                  width={72}
                  height={72}
                  className="mb-2 h-[72px] w-[72px] rounded-full border border-zinc-200 bg-white object-cover"
                />
              ) : null
            ) : null}
            <p className="text-sm font-medium">{profile?.displayName}</p>
          </div>

          {loadingDrink && !drink ? (
            <p className="text-center text-sm text-zinc-600">กำลังโหลด...</p>
          ) : drink ? (
            <>
              {drink.status !== "checked_in" ? (
                <p className="text-center text-sm text-zinc-600">
                  ดูระดับพลังแบบเต็มได้หลังเช็คอินเข้างาน — สถานะปัจจุบัน: {drink.status}
                </p>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">ฉายา</p>
                    <p className="text-2xl font-bold leading-snug tracking-tight text-[var(--brand)] sm:text-3xl">
                      {drink.nickname}
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                      แก้วที่บันทึกในงาน
                    </p>
                    <p className="mt-1 text-4xl font-bold tabular-nums text-amber-950">{drink.drinkCount}</p>
                  </div>
                </>
              )}

              <div className="mt-6">
                <Link
                  href="/liff/beer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm"
                >
                  <Beer className="h-4 w-4" />
                  ไปเติมแก้ว / พลัง
                </Link>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="mt-4 inline-flex items-center justify-center gap-2 text-center text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
