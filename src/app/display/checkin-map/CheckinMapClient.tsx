"use client";

import type { CheckinDisplayCheckoutPayload, CheckinDisplayPayload } from "@/lib/checkin-display-broadcast";
import {
  type CharacterAnimKey,
  type Direction4,
  type WalkMode,
  getSpriteRect,
  parseAnimateCharacter
} from "@/lib/adobe-animate-parse";
import type { SpritemapJson } from "@/lib/adobe-animate-spritemap";
import { isOrganizerBookingId } from "@/lib/map-organizer-booking-ids";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EVENT_TITLE = "ALEXCRAFT 4TH ANNIVERSARY EVENT NIGHT";

type GuestRow = {
  bookingId: string;
  fullName: string;
  pictureUrl: string | null;
  checkedInAt: string;
  guestNumber: number;
  drinkCount: number;
  checkedOutAt: string | null;
};

type MapCharId = 1 | 2 | 3;

type MapEntity = {
  bookingId: string;
  fullName: string;
  drinkCount: number;
  charId: MapCharId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  nextGoalAt: number;
};

type CharacterBundle = {
  image: HTMLImageElement;
  spritemap: SpritemapJson;
  anims: Map<CharacterAnimKey, string[]>;
};

function normalizeDrinkCount(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function isGuestCheckedOut(g: GuestRow): boolean {
  return g.checkedOutAt != null && String(g.checkedOutAt).trim() !== "";
}

function drinkWalkMode(count: number): WalkMode {
  return count > 6 ? "super" : "sober";
}

function directionFromVelocity(vx: number, vy: number): Direction4 {
  if (Math.abs(vx) < 1e-5 && Math.abs(vy) < 1e-5) return "front";
  if (Math.abs(vy) >= Math.abs(vx)) {
    return vy > 0 ? "front" : "back";
  }
  return vx > 0 ? "right" : "left";
}

function stableChar12(bookingId: string): 1 | 2 {
  let h = 2166136261;
  for (let i = 0; i < bookingId.length; i++) {
    h ^= bookingId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0 ? 1 : 2;
}

const BOUNDS = { minX: 0.08, maxX: 0.92, minY: 0.14, maxY: 0.86 };

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickTarget(): { x: number; y: number } {
  return { x: randomInRange(BOUNDS.minX, BOUNDS.maxX), y: randomInRange(BOUNDS.minY, BOUNDS.maxY) };
}

const NAME_LABEL_MAX_CHARS = 18;

function labelForMap(fullName: string): string {
  const t = fullName.trim() || "Guest";
  const chars = [...t];
  if (chars.length <= NAME_LABEL_MAX_CHARS) return t;
  return `${chars.slice(0, NAME_LABEL_MAX_CHARS - 1).join("")}…`;
}

/** แท็กชื่อเหนือหัว — spriteTopY คือ y บนสุดของกรอบวาดสไปรต์ */
function drawGuestNameTag(ctx: CanvasRenderingContext2D, cx: number, spriteTopY: number, text: string) {
  ctx.save();
  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const padX = 7;
  const padY = 3;
  const gapAboveSprite = 5;
  const bh = 20;
  const tw = ctx.measureText(text).width;
  const bw = Math.max(tw + padX * 2, 44);
  const bx = cx - bw / 2;
  const by = spriteTopY - gapAboveSprite - bh;

  ctx.fillStyle = "rgba(10, 10, 12, 0.78)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4f4f5";
  ctx.fillText(text, cx, by + bh - padY);
  ctx.restore();
}

const bundlePromises: Partial<Record<MapCharId, Promise<CharacterBundle>>> = {};

function loadCharacterBundle(charId: MapCharId): Promise<CharacterBundle> {
  const existing = bundlePromises[charId];
  if (existing) return existing;

  const base = `/animate/character_0${charId}`;
  bundlePromises[charId] = (async () => {
    const [animRes, mapRes] = await Promise.all([fetch(`${base}/Animation.json`), fetch(`${base}/spritemap1.json`)]);
    if (!animRes.ok || !mapRes.ok) {
      throw new Error("โหลดข้อมูลตัวละครไม่สำเร็จ");
    }
    const animationJson = await animRes.json();
    const spritemap = (await mapRes.json()) as SpritemapJson;

    const img = new Image();
    img.decoding = "async";
    img.src = `${base}/spritemap1.png`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("โหลดรูปตัวละครไม่สำเร็จ"));
    });

    const anims = parseAnimateCharacter(animationJson, spritemap);
    return { image: img, spritemap, anims };
  })();

  return bundlePromises[charId]!;
}

function resolveCharId(bookingId: string, pickCache: Map<string, MapCharId>): MapCharId {
  if (isOrganizerBookingId(bookingId)) return 3;
  const hit = pickCache.get(bookingId);
  if (hit) return hit;
  const v = stableChar12(bookingId);
  pickCache.set(bookingId, v);
  return v;
}

export function CheckinMapClient() {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [bundles, setBundles] = useState<Partial<Record<MapCharId, CharacterBundle>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const entitiesRef = useRef<Map<string, MapEntity>>(new globalThis.Map());
  const charPickRef = useRef<Map<string, MapCharId>>(new globalThis.Map());
  const lastTickRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/display/checkin-snapshot?token=${encodeURIComponent(token)}`);
      if (!r.ok) {
        let msg = `โหลดรายชื่อไม่สำเร็จ (${r.status})`;
        try {
          const j = (await r.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setSnapshotError(msg);
        return;
      }
      const data = (await r.json()) as { guests: GuestRow[] };
      const normalized = (data.guests ?? []).map((g) => ({
        ...g,
        bookingId: typeof g.bookingId === "string" ? g.bookingId : `guest-${g.guestNumber}`,
        checkedOutAt: g.checkedOutAt == null ? null : String(g.checkedOutAt),
        drinkCount: normalizeDrinkCount(g.drinkCount)
      }));
      setGuests((prev) => {
        const snapIds = new Set(normalized.map((g) => g.bookingId));
        const simExtras = prev.filter((g) => g.bookingId.startsWith("sim-") && !snapIds.has(g.bookingId));
        return [...normalized, ...simExtras];
      });
      setSnapshotError(null);
    } catch {
      setSnapshotError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองรีเฟรชหน้า");
    }
  }, [token]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    const origin = window.location.origin;
    const socket: Socket = io(origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"]
    });

    const onConnect = () => {
      setConnectionError(null);
      void fetchSnapshot();
    };

    const onCheckout = (payload: CheckinDisplayCheckoutPayload) => {
      setGuests((prev) =>
        prev.map((g) =>
          g.bookingId === payload.bookingId
            ? {
                ...g,
                checkedOutAt: payload.checkedOutAt,
                drinkCount: normalizeDrinkCount(payload.drinkCount)
              }
            : g
        )
      );
    };

    const applyPayload = (data: CheckinDisplayPayload) => {
      setConnectionError(null);
      setGuests((prev) => {
        const next = prev.some((g) => g.bookingId === data.bookingId)
          ? prev.map((g) =>
              g.bookingId === data.bookingId
                ? {
                    ...g,
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
        return next;
      });
    };

    socket.on("connect", onConnect);
    socket.on("check-in", applyPayload);
    socket.on("check-out", onCheckout);
    socket.on("connect_error", (err) => {
      setConnectionError(err.message || "เชื่อมต่อ Socket.IO ไม่ได้");
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("check-in", applyPayload);
      socket.off("check-out", onCheckout);
      socket.disconnect();
    };
  }, [fetchSnapshot]);

  const activeGuests = useMemo(() => guests.filter((g) => !isGuestCheckedOut(g)), [guests]);

  useEffect(() => {
    const map = entitiesRef.current;
    const picks = charPickRef.current;
    const activeIds = new Set(activeGuests.map((g) => g.bookingId));

    for (const id of [...map.keys()]) {
      if (!activeIds.has(id)) {
        map.delete(id);
      }
    }

    const now = performance.now();
    for (const g of activeGuests) {
      const existing = map.get(g.bookingId);
      const charId = resolveCharId(g.bookingId, picks);
      if (!existing) {
        const t = pickTarget();
        map.set(g.bookingId, {
          bookingId: g.bookingId,
          fullName: g.fullName,
          drinkCount: g.drinkCount,
          charId,
          x: t.x,
          y: t.y,
          targetX: t.x,
          targetY: t.y,
          nextGoalAt: now + 2000 + Math.random() * 3500
        });
      } else {
        existing.fullName = g.fullName;
        existing.drinkCount = g.drinkCount;
        existing.charId = charId;
      }
    }
  }, [activeGuests]);

  useEffect(() => {
    const ids = new Set<MapCharId>();
    for (const g of activeGuests) {
      ids.add(resolveCharId(g.bookingId, charPickRef.current));
    }
    void Promise.all(
      [...ids].map(async (id) => {
        try {
          const b = await loadCharacterBundle(id);
          setBundles((prev) => ({ ...prev, [id]: b }));
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : "โหลดตัวละครไม่สำเร็จ");
        }
      })
    );
  }, [activeGuests]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    const FRAME_MS = 110;
    /** ความเร็วจำลองในระบบพิกัด 0–1 ต่อวินาที — ค่าน้อยเดินช้าลง */
    const MOVE_PER_SEC = 0.03;

    const tick = (now: number) => {
      const last = lastTickRef.current || now;
      const dt = Math.min(0.045, (now - last) / 1000);
      lastTickRef.current = now;

      const cw = container.clientWidth;
      const ch = container.clientHeight;

      ctx.clearRect(0, 0, cw, ch);

      const entities = [...entitiesRef.current.values()].sort((a, b) => a.y - b.y);

      for (const e of entities) {
        const dx = e.targetX - e.x;
        const dy = e.targetY - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.006) {
          const step = Math.min(dist, MOVE_PER_SEC * dt);
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
        }
        e.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, e.x));
        e.y = Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, e.y));

        if (now >= e.nextGoalAt || dist < 0.012) {
          const t = pickTarget();
          e.targetX = t.x;
          e.targetY = t.y;
          e.nextGoalAt = now + 2500 + Math.random() * 4000;
        }

        const dir = directionFromVelocity(e.targetX - e.x, e.targetY - e.y);
        const mode = drinkWalkMode(e.drinkCount);
        const animKey = `${mode}_${dir}` as CharacterAnimKey;

        const bundle = bundles[e.charId];
        if (!bundle) continue;

        const seq = bundle.anims.get(animKey);
        if (!seq?.length) continue;

        let off = 0;
        for (let i = 0; i < e.bookingId.length; i++) {
          off = (off + e.bookingId.charCodeAt(i)) % seq.length;
        }
        const frameIdx = (Math.floor(now / FRAME_MS) + off) % seq.length;
        const spriteName = seq[frameIdx];
        const rect = getSpriteRect(bundle.spritemap, spriteName);
        if (!rect) continue;

        const px = e.x * cw;
        const py = e.y * ch;

        const drawH = ch * 0.14;
        const scale = drawH / rect.h;
        const dw = rect.w * scale;
        const dh = rect.h * scale;

        const spriteTopY = py - dh * 0.92;

        ctx.drawImage(bundle.image, rect.x, rect.y, rect.w, rect.h, px - dw * 0.5, spriteTopY, dw, dh);

        drawGuestNameTag(ctx, px, spriteTopY, labelForMap(e.fullName));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bundles, activeGuests.length]);

  const checkinHref = useMemo(() => {
    return token ? `/display/checkin?token=${encodeURIComponent(token)}` : "/display/checkin";
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0a0a0c] text-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={checkinHref}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            Check-in จอ
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-2 text-xs font-semibold text-[var(--brand)] sm:text-sm">
            <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden />
            แผนที่งาน
          </span>
        </div>
      </header>

      {connectionError ? (
        <p className="shrink-0 px-4 py-2 text-center text-xs text-amber-400/95 sm:text-sm">{connectionError}</p>
      ) : null}
      {snapshotError ? (
        <p className="shrink-0 px-4 py-2 text-center text-xs text-amber-300/95 sm:text-sm">{snapshotError}</p>
      ) : null}
      {loadError ? (
        <p className="shrink-0 px-4 py-2 text-center text-xs text-red-400 sm:text-sm">{loadError}</p>
      ) : null}

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed bg */}
        <img src="/images/background.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

        {activeGuests.length === 0 && !snapshotError ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 px-4">
            <p className="max-w-lg text-center text-base leading-relaxed text-zinc-200 sm:text-lg">
              {guests.length > 0 ? (
                <>
                  มีผู้เข้าร่วมในระบบ แต่<strong className="font-semibold text-white"> ทุกคนเช็คเอาท์แล้ว</strong>
                  — แผนที่แสดงเฉพาะคนที่ยังอยู่ในงาน (ยังไม่ check out)
                </>
              ) : (
                <>รอผู้เข้าร่วมเช็คอิน…</>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
