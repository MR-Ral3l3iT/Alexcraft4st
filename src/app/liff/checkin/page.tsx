"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { LogIn, MapPin, PartyPopper, TriangleAlert, UserRound } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { BookingStatus } from "@/types/booking";
import { useCallback, useEffect, useState } from "react";

const LIFF_PROFILE_STORAGE_KEY = "alexcraft:liffProfile";

type CachedLiffProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
};

type CheckinRemaining = {
  days: number;
  hours: number;
  minutes: number;
};

type CheckinResponse = {
  message: string;
  code?: string;
  distanceMeters?: number;
  radiusMeters?: number;
  checkinOpensAt?: string;
  checkinOpensAtFormattedTh?: string;
  remaining?: CheckinRemaining;
  booking?: {
    status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
    checkedInAt: string | null;
  };
  alreadyCheckedIn?: boolean;
};

type BookingSummary = {
  bookingCode: string | null;
  fullName: string;
  status: BookingStatus;
  lineDisplay: string | null;
  linePictureUrl: string | null;
};

export default function LiffCheckinPage() {
  const searchParams = useSearchParams();
  const [lineUserId, setLineUserId] = useState("");
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [distanceInfo, setDistanceInfo] = useState("");
  const [countdownHint, setCountdownHint] = useState("");
  const [loginStarting, setLoginStarting] = useState(false);
  /** รูปจาก cache ฝั่ง client เมื่อ booking ยังไม่มี linePictureUrl */
  const [cachedLinePictureUrl, setCachedLinePictureUrl] = useState<string | null>(null);

  const resolveLineUserId = useCallback(() => {
    const q = searchParams.get("lineUserId");
    if (q?.trim()) return q.trim();
    try {
      const raw = window.localStorage.getItem(LIFF_PROFILE_STORAGE_KEY);
      if (!raw) return "";
      const cached = JSON.parse(raw) as CachedLiffProfile;
      if (cached?.lineUserId) return cached.lineUserId;
    } catch {
      /* ignore */
    }
    return "";
  }, [searchParams]);

  useEffect(() => {
    setLineUserId(resolveLineUserId());
  }, [resolveLineUserId]);

  useEffect(() => {
    if (!lineUserId.trim()) {
      setBooking(null);
      setBookingError("");
      setBookingLoading(false);
      return;
    }

    let cancelled = false;
    async function loadBooking() {
      setBookingLoading(true);
      setBookingError("");
      try {
        const response = await fetch(`/api/bookings?lineUserId=${encodeURIComponent(lineUserId.trim())}`);
        const data = (await response.json()) as BookingSummary & { message?: string };
        if (!response.ok) {
          if (!cancelled) {
            setBooking(null);
            setBookingError(data.message ?? "ไม่พบการจอง");
          }
          return;
        }
        if (!cancelled) {
          setBooking({
            bookingCode: data.bookingCode ?? null,
            fullName: data.fullName,
            status: data.status,
            lineDisplay: data.lineDisplay ?? null,
            linePictureUrl: data.linePictureUrl ?? null
          });
        }
      } catch {
        if (!cancelled) {
          setBooking(null);
          setBookingError("โหลดข้อมูลการจองไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setBookingLoading(false);
      }
    }

    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [lineUserId]);

  useEffect(() => {
    if (!lineUserId.trim() || booking?.linePictureUrl) {
      setCachedLinePictureUrl(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(LIFF_PROFILE_STORAGE_KEY);
      if (!raw) {
        setCachedLinePictureUrl(null);
        return;
      }
      const cached = JSON.parse(raw) as CachedLiffProfile;
      if (cached.lineUserId === lineUserId.trim() && cached.pictureUrl) {
        setCachedLinePictureUrl(cached.pictureUrl);
      } else {
        setCachedLinePictureUrl(null);
      }
    } catch {
      setCachedLinePictureUrl(null);
    }
  }, [lineUserId, booking?.linePictureUrl]);

  const avatarSrc =
    liffProfileImageSrc(booking?.linePictureUrl) ?? liffProfileImageSrc(cachedLinePictureUrl);

  async function startLineLogin() {
    setLoginStarting(true);
    try {
      const response = await fetch(`/api/liff/login/start?redirectTo=${encodeURIComponent("/liff/checkin")}`);
      const data = (await response.json()) as { loginUrl?: string; message?: string };
      if (!response.ok || !data.loginUrl) {
        setError(data.message ?? "ไม่สามารถเริ่ม LINE Login ได้");
        return;
      }
      window.location.href = data.loginUrl;
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างเริ่ม LINE Login");
    } finally {
      setLoginStarting(false);
    }
  }

  async function selfCheckin() {
    setLoading(true);
    setError("");
    setMessage("");
    setDistanceInfo("");
    setCountdownHint("");

    if (!lineUserId.trim()) {
      setError("ไม่พบบัญชี LINE กรุณาเข้าสู่ระบบก่อน");
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/bookings/self-checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lineUserId: lineUserId.trim(),
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          });
          const data = (await response.json()) as CheckinResponse;
          if (!response.ok) {
            setError(data.message || "เช็คอินไม่สำเร็จ");
            if (data.code === "CHECKIN_NOT_OPEN" && data.checkinOpensAtFormattedTh) {
              setCountdownHint(`เปิดเช็คอิน: ${data.checkinOpensAtFormattedTh}`);
            }
            if (
              data.code === "OUTSIDE_CHECKIN_AREA" &&
              data.distanceMeters !== undefined &&
              data.radiusMeters !== undefined
            ) {
              setDistanceInfo(`ระยะจากจุดจัดงานประมาณ ${data.distanceMeters} เมตร (รัศมีอนุญาต ${data.radiusMeters} เมตร)`);
            }
            return;
          }
          setMessage(
            data.message
              ? `${data.message} — ตรวจสอบข้อความ Flex ในแชท LINE จากบัญชีทางการ`
              : "เช็คอินสำเร็จ — ตรวจสอบข้อความ Flex ในแชท LINE"
          );
          if (data.distanceMeters !== undefined && data.radiusMeters !== undefined) {
            setDistanceInfo(`ระยะจากจุดจัดงานประมาณ ${data.distanceMeters} เมตร (รัศมีอนุญาต ${data.radiusMeters} เมตร)`);
          }
          if (data.booking?.status === "checked_in") {
            setBooking((prev) => (prev ? { ...prev, status: "checked_in" } : prev));
          }
        } catch {
          setError("เกิดข้อผิดพลาดระหว่างส่งคำขอเช็คอิน");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("ไม่สามารถอ่านตำแหน่งได้ กรุณาเปิดสิทธิ์ตำแหน่ง หรือติดต่อแอดมินเพื่อเช็คอินแบบ manual");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000
      }
    );
  }

  const canSelfCheckin = booking?.status === "confirmed";
  const alreadyIn = booking?.status === "checked_in";

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-md p-4 pb-10 sm:p-6">
        <header className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Check-in</p>
            <h1 className="text-base font-semibold text-white sm:text-lg">ลงทะเบียนเข้างาน</h1>
          </div>
          <Image src="/alex-craft-logo.svg" alt="Alex Craft" width={36} height={36} className="h-9 w-9 shrink-0" />
        </header>

        {!lineUserId ? (
          <section className="rounded-2xl border border-zinc-700/60 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 text-center shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
              <LogIn className="h-7 w-7 text-[var(--brand)]" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              กรุณาเข้าสู่ระบบ LINE เพื่อยืนยันตัวตนก่อนเช็คอิน
            </p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              disabled={loginStarting}
              className="mt-5 w-full rounded-xl bg-[var(--brand)] py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 disabled:opacity-50"
            >
              {loginStarting ? "กำลังเปิด LINE Login..." : "เข้าสู่ระบบ LINE"}
            </button>
          </section>
        ) : bookingLoading ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-sm text-zinc-400">
            กำลังโหลดข้อมูลการจอง…
          </section>
        ) : bookingError || !booking ? (
          <section className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-center">
            <TriangleAlert className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm text-red-100">{bookingError || "ไม่พบการจอง"}</p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              className="mt-4 text-sm text-[var(--brand)] underline-offset-2 hover:underline"
            >
              ลองเข้าสู่ระบบ LINE อีกครั้ง
            </button>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 shadow-2xl shadow-black/50">
            <div className="h-24 bg-gradient-to-r from-[var(--brand)]/25 via-amber-900/20 to-transparent" />
            <div className="-mt-12 flex flex-col items-center px-5 pb-6 pt-0">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[var(--brand)] to-amber-600 opacity-80 blur-sm" />
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- proxied dynamic LINE CDN URL
                  <img
                    src={avatarSrc}
                    alt=""
                    width={104}
                    height={104}
                    className="relative z-10 h-[104px] w-[104px] rounded-full border-4 border-zinc-900 object-cover shadow-xl"
                  />
                ) : (
                  <div className="relative z-10 flex h-[104px] w-[104px] items-center justify-center rounded-full border-4 border-zinc-900 bg-zinc-800 text-3xl font-bold text-[var(--brand)] shadow-xl">
                    {booking.fullName.trim().charAt(0) || <UserRound className="h-12 w-12 text-zinc-500" />}
                  </div>
                )}
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">ชื่อในงาน</p>
              <p className="mt-1 text-center text-2xl font-bold leading-tight text-white">{booking.fullName}</p>
              {booking.lineDisplay && booking.lineDisplay !== booking.fullName ? (
                <p className="mt-1 text-sm text-zinc-400">LINE: {booking.lineDisplay}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-zinc-600/80 bg-zinc-800/80 px-3 py-1 text-xs text-zinc-300">
                  รหัสจอง <span className="font-mono font-semibold text-white">{booking.bookingCode ?? "—"}</span>
                </span>
                <span className="rounded-full border border-zinc-600/80 bg-zinc-800/80 px-3 py-1 text-xs text-zinc-300">
                  {bookingStatusLabel(booking.status)}
                </span>
              </div>

              {alreadyIn ? (
                <div className="mt-6 flex w-full items-center gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
                  <PartyPopper className="h-5 w-5 shrink-0 text-emerald-400" />
                  <span>คุณเช็คอินแล้ว ดูรายละเอียดได้ที่เมนูหรือหน้าสถานะ</span>
                </div>
              ) : !canSelfCheckin ? (
                <div className="mt-6 w-full rounded-xl border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-center text-sm text-amber-100/95">
                  สถานะนี้ยังไม่เปิดให้เช็คอินด้วยตนเอง — ชำระเงิน/รออนุมัติให้ครบก่อน หรือดูสถานะที่เมนู &quot;ดูสถานะ&quot;
                </div>
              ) : (
                <>
                  <p className="mt-5 inline-flex items-start gap-2 text-left text-xs leading-relaxed text-zinc-500">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    กดปุ่มด้านล่างเพื่อให้ระบบตรวจสอบตำแหน่งและเวลา หากผ่านจะส่งข้อความ Flex ยืนยันไปในแชท LINE
                    อัตโนมัติ หากไม่ผ่านเงื่อนไข กรุณาติดต่อแอดมินหน้างาน
                  </p>

                  <button
                    type="button"
                    onClick={() => void selfCheckin()}
                    disabled={loading}
                    className="mt-5 w-full rounded-xl bg-[var(--brand)] py-4 text-base font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? "กำลังตรวจสอบตำแหน่ง…" : "ลงทะเบียนเข้างาน"}
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {message ? (
          <p className="mt-5 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-center text-sm text-emerald-100">
            {message}
          </p>
        ) : null}
        {distanceInfo ? <p className="mt-2 text-center text-xs text-zinc-500">{distanceInfo}</p> : null}
        {countdownHint ? <p className="mt-2 text-center text-xs text-amber-400/90">{countdownHint}</p> : null}
        {error ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
