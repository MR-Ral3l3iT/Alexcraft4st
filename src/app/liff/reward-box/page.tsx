"use client";

import Image from "next/image";
import { AlertTriangle, Gift } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type LiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
};

type DrawApiResponse = {
  hasDraw: boolean;
  won?: boolean;
  rewardName?: string | null;
  loseReason?: string | null;
  milestoneLevel: number;
  pushed?: boolean;
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

function parseMilestone(raw: string | null): 1 | 2 | 3 | null {
  const value = Number(raw);
  if (value === 1 || value === 2 || value === 3) return value;
  return null;
}

function loseReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "-";
  if (reason === "NO_STOCK" || reason === "OUT_OF_STOCK") return "ยังไม่มีของรางวัลให้จับในช่วงนี้";
  if (reason === "PROBABILITY_MISS") return "โชคยังไม่เข้าข้างในครั้งนี้";
  if (reason === "MILESTONE_QUOTA_FULL") return "โควตารอบ milestone นี้เต็มแล้ว (ของเหลือจะทบไปรอบถัดไป)";
  return reason;
}

function RewardBoxPageContent() {
  const searchParams = useSearchParams();
  const milestone = useMemo(() => parseMilestone(searchParams.get("milestone")), [searchParams]);

  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);

  const [loadingState, setLoadingState] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [draw, setDraw] = useState<DrawApiResponse | null>(null);

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

  const refreshDrawState = useCallback(async (lineUserId: string, milestoneLevel: 1 | 2 | 3) => {
    setLoadingState(true);
    setError("");
    try {
      const params = new URLSearchParams({
        lineUserId,
        milestone: String(milestoneLevel)
      });
      const response = await fetch(`/api/liff/reward-draw?${params.toString()}`);
      const data = (await response.json()) as DrawApiResponse & { message?: string };
      if (!response.ok) {
        setDraw(null);
        setError(data.message ?? "โหลดสถานะการเปิดกล่องไม่สำเร็จ");
        return;
      }
      setDraw(data);
    } catch {
      setDraw(null);
      setError("เกิดข้อผิดพลาดในการโหลดสถานะ");
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.lineUserId || !milestone) return;
    void refreshDrawState(profile.lineUserId, milestone);
  }, [profile?.lineUserId, milestone, refreshDrawState]);

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const redirectTo = milestone ? `/liff/reward-box?milestone=${encodeURIComponent(String(milestone))}` : "/liff/reward-box";
      const response = await fetch(`/api/liff/login/start?redirectTo=${encodeURIComponent(redirectTo)}`);
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

  async function openBox() {
    if (!profile?.lineUserId || !milestone) return;
    setOpening(true);
    setToast("");
    setError("");
    try {
      const response = await fetch("/api/liff/reward-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.lineUserId, milestoneLevel: milestone })
      });
      const data = (await response.json()) as DrawApiResponse & { message?: string; code?: string };
      if (!response.ok) {
        setError(data.message ?? "เปิดกล่องไม่สำเร็จ");
        return;
      }

      setDraw({
        hasDraw: true,
        won: data.won,
        rewardName: data.rewardName,
        loseReason: data.loseReason,
        milestoneLevel: milestone
      });

      if (data.message) {
        setToast(data.message);
      } else if (data.won) {
        setToast(`ยินดีด้วย! คุณได้รับรางวัล: ${data.rewardName ?? "-"}`);
      } else {
        setToast(`ยังไม่ได้รางวัลในครั้งนี้ (${loseReasonLabel(data.loseReason)})`);
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างเปิดกล่อง");
    } finally {
      setOpening(false);
    }
  }

  if (!milestone) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center p-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
            <p className="text-sm text-zinc-700">ลิงก์ไม่ครบ — กรุณาเปิดจากปุ่มใน LINE</p>
          </div>
        </div>
      </main>
    );
  }

  if (!loadingProfile && !profile?.lineUserId) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center p-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
            <div className="mb-4 flex justify-center">
              <Image src="/alex-craft-logo.svg" alt="" width={92} height={92} className="h-auto" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--brand)]">เปิดกล่องรางวัล</h2>
            <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE เพื่อเปิดกล่อง</p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              disabled={startingLogin}
              className="mt-5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {startingLogin ? "กำลังพาไป LINE Login..." : "Login with LINE"}
            </button>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  const alreadyOpened = Boolean(draw?.hasDraw);

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-md p-4 sm:p-6">
        <div className="mb-3 flex justify-end">
          <Image src="/alex-craft-logo.svg" alt="" width={34} height={34} className="h-auto" />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)]">
              <Gift className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-950 sm:text-xl">เปิดกล่องรางวัล</h1>
            <p className="mt-1 text-sm text-zinc-600">Milestone {milestone} · สิทธิ์ครั้งเดียวต่อ milestone</p>
          </div>

          {profile ? (
            <p className="mb-4 text-center text-sm text-zinc-700">
              สวัสดี <span className="font-semibold">{profile.displayName}</span>
            </p>
          ) : null}

          {loadingState && !draw ? <p className="text-center text-sm text-zinc-600">กำลังโหลดสถานะ...</p> : null}

          {alreadyOpened ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-900">เปิดกล่อง milestone นี้แล้ว</p>
              <p className="mt-2 text-sm text-emerald-900/90">
                {draw?.won ? (
                  <>
                    คุณได้รับรางวัล: <span className="font-semibold">{draw.rewardName ?? "-"}</span>
                  </>
                ) : (
                  <>ผลลัพธ์: ยังไม่ได้รางวัล ({loseReasonLabel(draw?.loseReason)})</>
                )}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void openBox()}
              disabled={opening || loadingState || !profile?.lineUserId}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-4 text-base font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {opening ? "กำลังเปิดกล่อง..." : "เปิดกล่องเลย"}
            </button>
          )}

          {error ? (
            <p className="mt-4 inline-flex items-center justify-center gap-2 text-center text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {toast ? <p className="mt-3 text-center text-sm text-emerald-700">{toast}</p> : null}
        </section>

        <div className="mt-6 flex justify-center">
          <a
            href="/liff/energy"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            กลับไปดูสถานะ
          </a>
        </div>
      </div>
    </main>
  );
}

export default function RewardBoxPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <RewardBoxPageContent />
    </Suspense>
  );
}
