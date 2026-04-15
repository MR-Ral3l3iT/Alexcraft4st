"use client";

import type { CheckinDisplayCheckoutPayload, CheckinDisplayPayload } from "@/lib/checkin-display-broadcast";
import { playCheckInChime } from "@/lib/checkin-chime";
import { drinkNicknameForCount } from "@/lib/drink-nickname";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { MessageSquare } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LIVE_PREVIEW_EMBED_URL =
  process.env.NEXT_PUBLIC_LIVE_PREVIEW_URL?.trim() ||
  process.env.NEXT_PUBLIC_ADMIN_LIVE_PREVIEW_URL?.trim() ||
  "https://0s2pthqfszzgxv-8002.proxy.runpod.net";

const LIVE_PREVIEW_SESSION_KEY = "alexcraft:displayCheckinLivePreviewOpen";

type GuestRow = {
  bookingId: string;
  fullName: string;
  pictureUrl: string | null;
  checkedInAt: string;
  guestNumber: number;
  drinkCount: number;
  checkedOutAt: string | null;
};

const EVENT_TITLE = "ALEXCRAFT 4TH ANNIVERSARY EVENT NIGHT";

function normalizeDrinkCount(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function isGuestCheckedOut(g: GuestRow): boolean {
  return g.checkedOutAt != null && String(g.checkedOutAt).trim() !== "";
}

/**
 * ลำดับการแสดงบนหน้าจอ TV:
 * 1) ยังอยู่ในงาน (ยังไม่ check out) ก่อน — คน check out แล้วไปท้ายสุด
 * 2) ในกลุ่มเดียวกัน: จำนวนแก้วมาก → น้อย
 * 3) แก้วเท่ากัน: เช็คอินล่าสุดก่อน (checkedInAt ใหม่กว่า)
 */
function checkedInAtMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** แถบ Recent Guests — เวลาเช็คอินล่าสุดก่อน (ไม่ผูกกับลำดับกริดหลักที่เรียงตามแก้ว) */
function recentGuestsByCheckInTime(items: GuestRow[], limit: number): GuestRow[] {
  return [...items]
    .sort((a, b) => {
      const diff = checkedInAtMs(b.checkedInAt) - checkedInAtMs(a.checkedInAt);
      if (diff !== 0) return diff;
      return b.guestNumber - a.guestNumber;
    })
    .slice(0, limit);
}

function sortGuestsForDisplay(items: GuestRow[]): GuestRow[] {
  return [...items].sort((a, b) => {
    const aOut = isGuestCheckedOut(a);
    const bOut = isGuestCheckedOut(b);
    if (aOut !== bOut) return aOut ? 1 : -1;

    const drinkDiff = normalizeDrinkCount(b.drinkCount) - normalizeDrinkCount(a.drinkCount);
    if (drinkDiff !== 0) return drinkDiff;

    return checkedInAtMs(b.checkedInAt) - checkedInAtMs(a.checkedInAt);
  });
}

function PresenceCornerBadge({ checkedOutAt }: { checkedOutAt: string | null }) {
  const checkedOut = Boolean(checkedOutAt);
  return (
    <span
      className={
        checkedOut
          ? "rounded-md bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-black/20 sm:text-[10px]"
          : "rounded-md bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-black/20 sm:text-[10px]"
      }
    >
      {checkedOut ? "Check out" : "Check in"}
    </span>
  );
}

function GuestAvatar({ pictureUrl, name, size = "md" }: { pictureUrl: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const src = liffProfileImageSrc(pictureUrl);
  const dim = size === "lg" ? "h-28 w-28 sm:h-36 sm:w-36" : size === "sm" ? "h-9 w-9" : "h-16 w-16";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- proxied LINE URL
      <img src={src} alt="" className={`${dim} shrink-0 rounded-full border-2 border-[var(--brand)]/35 object-cover`} />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full border-2 border-zinc-600 bg-zinc-800 text-xl font-bold text-[var(--brand)]`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CheckinTvClient() {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [popup, setPopup] = useState<CheckinDisplayPayload | null>(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** คิวป๊อปอัป + เสียง — การ์ดอัปเดตทันที แต่แสดงทีละคน */
  const celebrationQueueRef = useRef<CheckinDisplayPayload[]>([]);
  const celebrationPlayingRef = useRef(false);
  const flushCelebrationQueueRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(LIVE_PREVIEW_SESSION_KEY) === "1") setLivePreviewOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LIVE_PREVIEW_SESSION_KEY, livePreviewOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [livePreviewOpen]);

  const dismissPopup = useCallback(() => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    setPopup(null);
    celebrationPlayingRef.current = false;
    queueMicrotask(() => {
      flushCelebrationQueueRef.current();
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    void fetch(`/api/display/checkin-snapshot?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error("snapshot failed");
        return r.json() as Promise<{ capacity: number; checkedInCount: number; guests: GuestRow[] }>;
      })
      .then((data) => {
        setCapacity(data.capacity);
        setCheckedInCount(data.checkedInCount);
        const normalizedGuests = (data.guests ?? []).map((g) => ({
          ...g,
          bookingId: typeof g.bookingId === "string" ? g.bookingId : `guest-${g.guestNumber}`,
          checkedOutAt: g.checkedOutAt == null ? null : String(g.checkedOutAt),
          drinkCount: normalizeDrinkCount(g.drinkCount)
        }));
        setGuests(sortGuestsForDisplay(normalizedGuests));
      })
      .catch(() => {
        /* ignore — จอยังทำงานจาก socket ได้ */
      });
  }, []);

  useEffect(() => {
    const origin = window.location.origin;
    const socket: Socket = io(origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"]
    });

    const flushCelebrationQueue = () => {
      if (celebrationPlayingRef.current) return;
      const next = celebrationQueueRef.current.shift();
      if (!next) return;
      celebrationPlayingRef.current = true;
      playCheckInChime();
      setPopup(next);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => {
        setPopup(null);
        popupTimerRef.current = null;
        celebrationPlayingRef.current = false;
        flushCelebrationQueue();
      }, 5500);
    };
    flushCelebrationQueueRef.current = flushCelebrationQueue;

    const onCheckIn = (data: CheckinDisplayPayload) => {
      setConnectionError(null);
      celebrationQueueRef.current.push(data);
      flushCelebrationQueue();

      setGuests((prev) => {
        const next = prev.some((g) => g.bookingId === data.bookingId)
          ? prev.map((g) =>
              g.bookingId === data.bookingId
                ? {
                    bookingId: data.bookingId,
                    fullName: data.fullName,
                    pictureUrl: data.pictureUrl,
                    checkedInAt: data.checkedInAt,
                    guestNumber: data.guestNumber,
                    drinkCount: normalizeDrinkCount(data.drinkCount),
                    checkedOutAt: data.checkedOutAt ?? null
                  }
                : g
            )
          : [
              {
                bookingId: data.bookingId,
                fullName: data.fullName,
                pictureUrl: data.pictureUrl,
                checkedInAt: data.checkedInAt,
                guestNumber: data.guestNumber,
                drinkCount: normalizeDrinkCount(data.drinkCount),
                checkedOutAt: data.checkedOutAt ?? null
              },
              ...prev
            ];
        return sortGuestsForDisplay(next);
      });
      setCheckedInCount((c) => Math.max(c, data.guestNumber));
    };

    const onCheckout = (payload: CheckinDisplayCheckoutPayload) => {
      setGuests((prev) =>
        sortGuestsForDisplay(
          prev.map((g) =>
            g.bookingId === payload.bookingId
              ? {
                  ...g,
                  checkedOutAt: payload.checkedOutAt,
                  drinkCount: normalizeDrinkCount(payload.drinkCount)
                }
              : g
          )
        )
      );
    };

    socket.on("check-in", onCheckIn);
    socket.on("check-out", onCheckout);
    socket.on("connect_error", (err) => {
      setConnectionError(
        err.message ||
          "เชื่อมต่อ Socket.IO ไม่ได้ — รันแอปผ่าน npm run dev (server.mjs)"
      );
    });

    return () => {
      socket.off("check-in", onCheckIn);
      socket.off("check-out", onCheckout);
      socket.disconnect();
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
      celebrationQueueRef.current = [];
      celebrationPlayingRef.current = false;
      flushCelebrationQueueRef.current = () => {};
      setPopup(null);
    };
  }, []);

  const timeLabel = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  const recentStrip = useMemo(() => recentGuestsByCheckInTime(guests, 12), [guests]);
  const popupAvatar = popup ? liffProfileImageSrc(popup.pictureUrl) : null;

  return (
    <div className="flex min-h-0 min-h-[100dvh] flex-col bg-[#0a0a0c] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800/90 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset; avoids next/image SSR/client srcSet drift */}
          <img
            src="/images/alexcraft4st-logo.png"
            alt=""
            width={44}
            height={44}
            className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-xs">Alexcraft Brewing</p>
            <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-lg md:text-xl">{EVENT_TITLE}</h1>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 text-right sm:flex-row sm:items-center sm:gap-4 md:gap-6">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLivePreviewOpen((v) => !v)}
              aria-pressed={livePreviewOpen}
              title={livePreviewOpen ? "ปิด Live preview" : "เปิด Live preview"}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold text-zinc-900 shadow-sm transition sm:text-sm ${
                livePreviewOpen
                  ? "border-zinc-400 bg-zinc-100 ring-2 ring-[var(--brand)]/60 ring-offset-2 ring-offset-[#0a0a0c]"
                  : "border-zinc-300 bg-white hover:bg-zinc-50"
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-zinc-900" strokeWidth={2} aria-hidden />
              Live preview
            </button>
            <p className="text-xs text-zinc-300 sm:text-sm">
              <span className="text-zinc-500">จำนวนคนเข้างาน </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--brand)]">{checkedInCount}</span>
              {capacity > 0 ? (
                <>
                  {" "}
                  <span className="text-zinc-500">/ </span>
                  <span className="font-mono tabular-nums text-zinc-200">{capacity}</span>
                </>
              ) : null}
              <span className="text-zinc-500"> คน</span>
            </p>
          </div>
          <p className="font-mono text-xl font-semibold tabular-nums text-white sm:text-2xl" suppressHydrationWarning>
            {timeLabel}
          </p>
        </div>
      </header>

      {livePreviewOpen ? (
        <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-800/90 bg-zinc-950">
          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-2 pb-2 text-[11px] text-zinc-500 sm:px-6 sm:text-xs">
            <span>Live preview — แสดงภาพคนในงานแบบ realtime</span>
            <a
              href={LIVE_PREVIEW_EMBED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
            >
              เปิดในแท็บใหม่
            </a>
          </div>
          <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-black">
            <iframe title="Live preview" src={LIVE_PREVIEW_EMBED_URL} className="h-full min-h-0 w-full flex-1 border-0" />
          </div>
        </div>
      ) : (
        <>
          {connectionError ? (
            <p className="shrink-0 px-4 py-2 text-center text-xs text-amber-400/95 sm:text-sm">{connectionError}</p>
          ) : null}

          {/* Main grid */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
            {guests.length === 0 ? (
              <div className="flex h-full min-h-[40vh] items-center justify-center text-zinc-500">
                <p className="text-lg sm:text-xl">รอผู้เข้าร่วมเช็คอิน…</p>
              </div>
            ) : (
              <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {guests.map((g) => (
                  <article
                    key={g.bookingId}
                    className="relative flex flex-col items-center overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-2.5 py-3 text-center shadow-lg shadow-black/20"
                  >
                    <div className="absolute right-2 top-2 z-10">
                      <PresenceCornerBadge checkedOutAt={g.checkedOutAt} />
                    </div>
                    <GuestAvatar pictureUrl={g.pictureUrl} name={g.fullName} size="md" />
                    <p className="mt-2 w-full truncate text-[13px] font-semibold text-white">{g.fullName}</p>
                    <div className="mt-1 flex min-h-[2rem] items-start justify-center">
                      <span className="inline-flex max-w-full items-center rounded-full border border-[var(--brand)]/45 bg-[var(--brand)]/12 px-2 py-0.5 text-[11px] font-semibold leading-snug text-[var(--brand)]/95">
                        <span className="line-clamp-1">{drinkNicknameForCount(g.drinkCount)}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] tabular-nums text-zinc-300">🍺 {normalizeDrinkCount(g.drinkCount)} แก้ว</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Guest #{g.guestNumber}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Footer — Recent */}
          <footer className="shrink-0 border-t border-zinc-800/90 bg-zinc-950/80 px-4 py-3 sm:px-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500 sm:text-xs">Recent Guests</p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {recentStrip.length === 0 ? (
                <span className="text-sm text-zinc-600">—</span>
              ) : (
                recentStrip.map((g) => (
                  <div key={`foot-${g.bookingId}`} className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-3">
                    <GuestAvatar pictureUrl={g.pictureUrl} name={g.fullName} size="sm" />
                    <span className="max-w-[120px] truncate text-xs font-medium text-zinc-200">
                      {g.fullName.split(/\s+/)[0]}
                      <span className="ml-1 tabular-nums text-zinc-500">({g.drinkCount})</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </footer>
        </>
      )}

      {/* Popup NEW CHECK-IN */}
      {popup ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          onClick={dismissPopup}
          aria-label="ปิด"
        >
          <div
            className="tv-checkin-popup-panel pointer-events-auto w-full max-w-lg rounded-3xl border-2 border-[var(--brand)]/50 bg-gradient-to-b from-zinc-900 to-black px-6 py-8 text-center shadow-2xl shadow-orange-950/40 sm:px-10 sm:py-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="tv-checkin-sparkle text-lg font-bold tracking-[0.2em] text-[var(--brand)] sm:text-xl">✨ NEW CHECK-IN ✨</p>
            <div className="mt-8 flex justify-center">
              {popupAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={popupAvatar}
                  alt=""
                  className="h-36 w-36 rounded-full border-4 border-[var(--brand)]/50 object-cover shadow-xl sm:h-44 sm:w-44"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-zinc-600 bg-zinc-800 text-5xl font-bold text-[var(--brand)] sm:h-44 sm:w-44">
                  {popup.fullName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="mt-8 text-2xl font-bold text-white sm:text-3xl">คุณ {popup.fullName}</p>
            <p className="mt-3 text-lg font-semibold text-[var(--brand)]/95 sm:text-xl">
              {drinkNicknameForCount(normalizeDrinkCount(popup.drinkCount))}
            </p>
            <p className="mt-2 text-base tabular-nums text-zinc-300 sm:text-lg">🍺 {normalizeDrinkCount(popup.drinkCount)} แก้ว</p>
            <p className="mt-4 text-base text-zinc-400 sm:text-lg">Welcome to Alexcraft Brewing</p>
            <p className="mt-6 text-xl font-semibold tabular-nums text-[var(--brand)] sm:text-2xl">Guest #{popup.guestNumber}</p>
          </div>
        </button>
      ) : null}
    </div>
  );
}
