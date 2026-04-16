"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { PaymentQrCard } from "@/components/booking/PaymentQrCard";
import { PaymentSlipForm } from "@/components/booking/PaymentSlipForm";
import { AlertTriangle } from "lucide-react";
import Image from "next/image";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

type BookingStatusResponse = {
  bookingCode: string | null;
  fullName: string;
  seats: number;
  status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
  checkedInAt: string | null;
  paymentAmount: number | null;
  paymentRef: string | null;
  paymentQrImageUrl: string | null;
  paymentExpiresAt: string | null;
  slipUrl: string | null;
  paymentBankName: string | null;
  paymentAccountName: string | null;
  paymentAccountNo: string | null;
};

function statusHighlightStyle(status: BookingStatusResponse["status"]) {
  switch (status) {
    case "pending":
      return {
        panel: "border-amber-400/80 bg-gradient-to-b from-amber-50 to-orange-50/80 text-amber-950",
        kicker: "text-amber-800/90",
        hint: "ชำระเงินและแนบสลิปเมื่อพร้อม"
      };
    case "waiting_payment_review":
      return {
        panel: "border-orange-500/80 bg-gradient-to-b from-orange-50 to-amber-50/90 text-orange-950",
        kicker: "text-orange-900/85",
        hint: "ทีมงานกำลังตรวจสอบสลิป กรุณารอการแจ้งเตือน"
      };
    case "confirmed":
      return {
        panel: "border-emerald-500/70 bg-gradient-to-b from-emerald-50 to-teal-50/80 text-emerald-950",
        kicker: "text-emerald-900/85",
        hint: "การจองได้รับการยืนยันแล้ว พร้อมเข้าร่วมงาน"
      };
    case "checked_in":
      return {
        panel: "border-sky-500/70 bg-gradient-to-b from-sky-50 to-blue-50/80 text-sky-950",
        kicker: "text-sky-900/85",
        hint: "ยินดีต้อนรับเข้างานแล้ว"
      };
    case "cancelled":
      return {
        panel: "border-red-400/80 bg-gradient-to-b from-red-50 to-zinc-50 text-red-950",
        kicker: "text-red-900/85",
        hint: "รายการนี้ถูกยกเลิกแล้ว"
      };
    default:
      return {
        panel: "border-zinc-300 bg-zinc-50 text-zinc-900",
        kicker: "text-zinc-600",
        hint: ""
      };
  }
}

function BookingStatusPanel({ booking }: { booking: BookingStatusResponse }) {
  const label = bookingStatusLabel(booking.status);
  const { panel, kicker, hint } = statusHighlightStyle(booking.status);

  return (
    <section className={`mt-4 rounded-2xl border-2 p-5 shadow-sm ${panel}`}>
      <p className={`text-center text-xs font-semibold uppercase tracking-[0.12em] ${kicker}`}>สถานะปัจจุบัน</p>
      <p className="mt-3 text-center text-2xl font-bold leading-snug sm:text-3xl">{label}</p>
      {hint ? <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed opacity-95">{hint}</p> : null}

      <div className="mt-6 rounded-xl border border-black/5 bg-white/70 p-4 text-left text-zinc-900 backdrop-blur-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">รายละเอียดการจอง</p>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
            <dt className="text-zinc-500">ชื่อในงาน</dt>
            <dd className="text-right font-medium text-zinc-900">{booking.fullName}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
            <dt className="text-zinc-500">รหัสจอง</dt>
            <dd className="font-mono text-right font-semibold text-zinc-900">{booking.bookingCode ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
            <dt className="text-zinc-500">สิทธิ์เข้าร่วม</dt>
            <dd className="text-right font-medium text-zinc-900">{booking.seats} ที่</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-zinc-500">เวลาเช็คอิน</dt>
            <dd className="text-right font-medium text-zinc-900">
              {booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString("th-TH") : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function StatusPageContent() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [startingLogin, setStartingLogin] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingStatusResponse | null>(null);
  const [bookingNotFound, setBookingNotFound] = useState(false);

  const [manualId, setManualId] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

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

    void loadProfile();
  }, [searchParams]);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    const uid = profile.lineUserId;

    let cancelled = false;
    async function loadBooking() {
      setLoadingBooking(true);
      setError("");
      setBooking(null);
      setBookingNotFound(false);
      try {
        const response = await fetch(`/api/bookings?lineUserId=${encodeURIComponent(uid)}`);
        const data = (await response.json()) as BookingStatusResponse & { message?: string };
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 404) {
            setBookingNotFound(true);
            return;
          }
          setError(data.message || "ไม่พบรายการจอง");
          return;
        }
        setBooking(data);
      } catch {
        if (!cancelled) setError("เกิดข้อผิดพลาดในการโหลดสถานะ");
      } finally {
        if (!cancelled) setLoadingBooking(false);
      }
    }

    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [profile?.lineUserId]);

  async function startLineLogin() {
    setStartingLogin(true);
    setError("");
    try {
      const response = await fetch("/api/liff/login/start?redirectTo=/liff/status");
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

  async function onManualSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualLoading(true);
    setError("");
    setBooking(null);
    setBookingNotFound(false);
    try {
      const response = await fetch(`/api/bookings?lineUserId=${encodeURIComponent(manualId.trim())}`);
      const data = (await response.json()) as BookingStatusResponse & { message?: string };
      if (!response.ok) {
        if (response.status === 404) {
          setBookingNotFound(true);
          return;
        }
        setError(data.message || "ไม่พบรายการจอง");
        return;
      }
      setBooking(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setManualLoading(false);
    }
  }

  if (!loadingProfile && !profile?.lineUserId) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto flex min-h-[78vh] max-w-md items-center justify-center p-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-900 shadow-sm">
            <div className="mb-4 flex justify-center">
              <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={92} height={92} className="h-auto" />
            </div>
            <h2 className="text-xl font-semibold">ตรวจสอบสถานะการจอง</h2>
            <p className="mt-2 text-sm text-zinc-600">กรุณาเข้าสู่ระบบด้วย LINE เพื่อดูสถานะของคุณ</p>
            <button
              type="button"
              onClick={() => void startLineLogin()}
              disabled={startingLogin}
              className="mt-5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startingLogin ? "กำลังพาไป LINE Login..." : "Login with LINE"}
            </button>
            <form onSubmit={onManualSearch} className="mt-8 border-t border-zinc-200 pt-6 text-left">
              <p className="mb-2 text-xs text-zinc-500">ทางเลือก (เช่น ทดสอบนอก LINE): ค้นด้วย LINE User ID</p>
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="LINE User ID"
              />
              <button
                type="submit"
                disabled={manualLoading || !manualId.trim()}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
              >
                {manualLoading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </form>
            {error ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}
            {booking ? <BookingStatusPanel booking={booking} /> : null}
            {bookingNotFound && !booking ? (
              <section className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-100 p-5 text-center">
                <p className="text-lg font-semibold text-zinc-800">ยังไม่พบการจอง</p>
                <p className="mt-2 text-sm text-zinc-600">ไม่มีรายการจองสำหรับ LINE User ID ที่ค้นหา</p>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="admin-panel mb-4 flex items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-base font-semibold sm:text-xl">ตรวจสอบสถานะการจอง</h1>
          <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={34} height={34} className="h-auto" />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-900 shadow-sm">
          {loadingProfile ? (
            <p className="text-sm text-zinc-600">กำลังโหลดโปรไฟล์...</p>
          ) : (
            <>
              <div className="mb-3 flex justify-center">
                {profile?.pictureUrl ? (
                  <img
                    src={liffProfileImageSrc(profile.pictureUrl) || ""}
                    alt={profile.displayName}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-full border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-zinc-200 bg-zinc-200 text-2xl font-semibold text-zinc-600">
                    {(profile?.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="text-base font-semibold">{profile?.displayName ?? "-"}</p>
            </>
          )}
        </section>

        {error && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        )}

        {loadingBooking && (
          <p className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-600">
            กำลังโหลดสถานะการจอง...
          </p>
        )}

        {!loadingBooking && booking ? (
          <>
            <BookingStatusPanel booking={booking} />

            {booking.status === "pending" && booking.bookingCode ? (
              <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-sm">
                <h2 className="text-base font-semibold">ชำระเงินและแนบสลิป</h2>
                <p className="mt-1 text-sm text-zinc-600">สแกน QR เพื่อชำระเงิน แล้วอัปโหลดสลิปด้านล่าง</p>
                <PaymentQrCard
                  bookingCode={booking.bookingCode}
                  initialAmount={booking.paymentAmount}
                  initialRef={booking.paymentRef}
                  initialImageUrl={booking.paymentQrImageUrl}
                  initialExpiresAt={booking.paymentExpiresAt}
                  bankName={booking.paymentBankName}
                  accountName={booking.paymentAccountName}
                  accountNo={booking.paymentAccountNo}
                />
                <PaymentSlipForm
                  bookingCode={booking.bookingCode}
                  initialSlipUrl={booking.slipUrl}
                  initialStatus={booking.status}
                />
              </section>
            ) : null}
          </>
        ) : null}

        {!loadingBooking && bookingNotFound && profile?.lineUserId ? (
          <section className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-100 p-6 text-center">
            <p className="text-lg font-semibold text-zinc-800">ยังไม่พบการจอง</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              บัญชี LINE นี้ยังไม่มีรายการจองในระบบ หรือยังไม่ได้ลงทะเบียน
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <StatusPageContent />
    </Suspense>
  );
}
