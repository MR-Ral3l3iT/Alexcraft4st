"use client";

import { UserPlus, Send, AlertCircle, UserRound, Phone, Beer, Zap, LogOut, ClipboardList } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";

type LiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
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

type RegisterResponse = {
  bookingCode: string | null;
};

type BookingLookupResponse = {
  bookingCode?: string | null;
  message?: string;
  status?: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
};

function redirectForExistingBooking(
  bookingCode: string,
  status: BookingLookupResponse["status"],
  lineUserId: string
): { path: string; notice: string } {
  if (status === "confirmed") {
    return {
      path: `/liff/checkin?lineUserId=${encodeURIComponent(lineUserId)}`,
      notice: "พบการจองที่ยืนยันแล้ว กำลังพาไปหน้าเช็คอิน..."
    };
  }
  if (status === "cancelled") {
    return { path: "/liff/status", notice: "พบรายการจอง (ถูกยกเลิก) กำลังพาไปหน้าสถานะ..." };
  }
  return {
    path: `/booking/${encodeURIComponent(bookingCode)}`,
    notice: "พบรายการลงทะเบียนเดิม กำลังพาไปหน้าชำระเงิน..."
  };
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingExistingBooking, setCheckingExistingBooking] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState("");
  /** เช็คอินแล้วแต่เปิดมาที่ /liff/register (เช่น Rich Menu ชี้ Endpoint ผิด / ไม่มี ?p=) — ไม่ส่งไป /liff/status ทับทุกปุ่ม */
  const [checkedInHub, setCheckedInHub] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

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
        setError("ไม่สามารถโหลด LIFF profile ได้");
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [searchParams]);

  const canSubmit = useMemo(() => {
    return !!profile?.lineUserId && fullName.trim() && phone.trim();
  }, [profile?.lineUserId, fullName, phone]);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    const uid = profile.lineUserId.trim();
    if (!uid) return;

    let cancelled = false;
    async function checkExistingBooking() {
      setCheckingExistingBooking(true);
      try {
        const response = await fetch(`/api/bookings?lineUserId=${encodeURIComponent(uid)}`);
        const data = (await response.json()) as BookingLookupResponse;
        if (!response.ok) return;
        const code = data.bookingCode ?? null;
        const st = data.status;
        if (!cancelled && code && st) {
          if (st === "checked_in") {
            setCheckedInHub(true);
            return;
          }
          const { path, notice } = redirectForExistingBooking(code, st, uid);
          setRedirectNotice(notice);
          router.replace(path);
        }
      } catch {
        // ignore and allow user to continue with form
      } finally {
        if (!cancelled) setCheckingExistingBooking(false);
      }
    }

    void checkExistingBooking();
    return () => {
      cancelled = true;
    };
  }, [profile?.lineUserId, router]);

  const isPreparingView =
    !checkedInHub && (loadingProfile || checkingExistingBooking || !!redirectNotice);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setError("");
    setRedirectNotice("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.lineUserId,
          lineDisplay: profile.displayName,
          linePictureUrl: profile.pictureUrl ?? undefined,
          fullName,
          phone
        })
      });

      const data = (await response.json()) as RegisterResponse & { message?: string };
      if (!response.ok) {
        if (response.status === 409 && profile?.lineUserId) {
          try {
            const existingResponse = await fetch(
              `/api/bookings?lineUserId=${encodeURIComponent(profile.lineUserId)}`
            );
            const existing = (await existingResponse.json()) as BookingLookupResponse;
            if (existingResponse.ok && existing.bookingCode) {
              if (existing.status === "checked_in") {
                setCheckedInHub(true);
                return;
              }
              const { path, notice } = redirectForExistingBooking(
                existing.bookingCode,
                existing.status,
                profile.lineUserId
              );
              setRedirectNotice(notice);
              router.push(path);
              return;
            }
          } catch {
            // keep default error handling
          }
        }
        setError(data.message || "ลงทะเบียนไม่สำเร็จ");
        return;
      }

      if (data.bookingCode) {
        setRedirectNotice("ลงทะเบียนสำเร็จ กำลังพาไปหน้าชำระเงิน...");
        router.push(`/booking/${encodeURIComponent(data.bookingCode)}`);
        return;
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างส่งข้อมูล");
    } finally {
      setSubmitting(false);
    }
  }

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const response = await fetch("/api/liff/login/start?redirectTo=/liff/register");
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

  if (!loadingProfile && profile?.lineUserId && checkedInHub) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
        <h2 className="text-center text-lg font-semibold text-[var(--brand)]">คุณเช็คอินเข้างานแล้ว</h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          เลือกเมนูด้านล่างได้เลย — ถ้ากด Rich Menu แล้วมาหน้านี้บ่อยๆ ตรวจใน LINE Developers ว่า Endpoint เป็น{" "}
          <span className="font-mono text-xs">…/liff</span> และลิงก์เมนูใช้{" "}
          <span className="font-mono text-[10px] sm:text-xs">?p=/liff/…</span>
        </p>
        <nav className="mt-6 grid gap-3">
          <a
            href="/liff/beer"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            <Beer className="h-4 w-4 text-amber-600" />
            เติมพลัง (เบียร์)
          </a>
          <a
            href="/liff/energy"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            <Zap className="h-4 w-4 text-sky-600" />
            ระดับพลังของฉัน
          </a>
          <a
            href="/liff/checkout"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4 text-zinc-600" />
            กลับบ้าน / Check out
          </a>
          <a
            href="/liff/status"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <ClipboardList className="h-4 w-4 text-[var(--brand)]" />
            ดูสถานะการจอง
          </a>
        </nav>
      </div>
    );
  }

  if (!loadingProfile && !profile?.lineUserId) {
    return (
      <div className="flex min-h-[78vh] items-center justify-center">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
          <div className="mb-4 flex justify-center">
            <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={92} height={92} className="h-auto" />
          </div>
          <h2 className="text-xl font-semibold">Alex Craft Event</h2>
          <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE เพื่อเริ่มลงทะเบียน</p>
          <button
            type="button"
            onClick={() => void startLineLogin()}
            disabled={startingLogin}
            className="mt-5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {startingLogin ? "กำลังพาไป LINE Login..." : "Login with LINE"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
      <div className="mb-5 flex items-center justify-center gap-2 text-center">
        <UserPlus className="h-5 w-5 text-[var(--brand)]" />
        <h2 className="text-lg font-semibold">ลงทะเบียนเข้างาน</h2>
      </div>
      <div className="mb-6 p-2 text-center text-sm text-zinc-800">
        {isPreparingView ? (
          redirectNotice || "กำลังโหลด LIFF profile..."
        ) : (
          <>
            <div className="mb-3 flex justify-center">
              {profile?.pictureUrl ? (
                <img
                  src={liffProfileImageSrc(profile.pictureUrl) || ""}
                  alt={profile.displayName}
                  width={92}
                  height={92}
                  className="h-[92px] w-[92px] rounded-full border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-zinc-200 bg-zinc-200 text-2xl font-semibold text-zinc-600">
                  {(profile?.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="font-medium">{profile?.displayName || "-"}</p>
          </>
        )}
      </div>

      {!isPreparingView ? (
        <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 inline-flex items-center gap-2 text-sm">
            <UserRound className="h-4 w-4 text-zinc-500" />
            ชื่อใช้ในการร่วมงาน
          </span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 inline-flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-zinc-500" />
            เบอร์โทร
          </span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            minLength={10}
            placeholder="กรอกเบอร์โทร 10 หลัก"
            required
          />
        </label>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={!canSubmit || submitting || checkingExistingBooking || !!redirectNotice}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? "กำลังส่ง..." : "ยืนยันลงทะเบียน"}
          </button>
        </div>
        </form>
      ) : null}

      {error && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
