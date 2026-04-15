"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { kanit } from "@/fonts";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, SearchCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const PAGE_SIZE = 20;

/** สถานะในงาน / เช็คเอาท์ (รายการเป็น booking ที่ checked_in แล้วเท่านั้น) */
const CHECKOUT_FILTER_OPTIONS = [
  { value: "", label: "ทั้งหมด (เช็คอินแล้ว)" },
  { value: "in_event", label: "ยังอยู่ในงาน (ยังไม่เช็คเอาท์)" },
  { value: "checked_out", label: "เช็คเอาท์แล้ว" }
] as const;

type CheckinResult = {
  message: string;
  booking?: {
    fullName: string;
    bookingCode: string | null;
    status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
    checkedInAt: string | null;
    drinkCount?: number;
    checkedOutAt?: string | null;
  };
};

type CheckedInRow = {
  id: string;
  fullName: string;
  bookingCode: string | null;
  phone: string;
  checkedInAt: string | null;
  lineDisplay: string | null;
  drinkCount?: number;
  checkedOutAt: string | null;
};

type CheckedInListResponse = {
  rows: CheckedInRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
};

export default function CheckinPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [checkoutFilter, setCheckoutFilter] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [roster, setRoster] = useState<CheckedInRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listNonce, setListNonce] = useState(0);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => window.clearTimeout(id);
  }, [q]);

  useLayoutEffect(() => {
    setPage(1);
  }, [debouncedQ, checkoutFilter]);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    setRosterError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (checkoutFilter) params.set("checkoutStatus", checkoutFilter);
      if (debouncedQ) params.set("q", debouncedQ);
      const response = await fetch(`/api/admin/checked-in?${params.toString()}`);
      let data: CheckedInListResponse & { message?: string };
      try {
        data = (await response.json()) as CheckedInListResponse & { message?: string };
      } catch {
        setRoster([]);
        setTotal(0);
        setRosterError("โหลดรายชื่อไม่สำเร็จ — ตอบกลับจากเซิร์ฟเวอร์ไม่ใช่ JSON");
        return;
      }
      if (!response.ok) {
        setRoster([]);
        setTotal(0);
        setRosterError(data.message || "โหลดรายชื่อผู้เช็คอินไม่สำเร็จ");
        return;
      }
      const maxPage = Math.max(1, Math.ceil(data.total / data.pageSize));
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }
      setRoster(data.rows ?? []);
      setTotal(data.total);
    } catch {
      setRoster([]);
      setTotal(0);
      setRosterError("โหลดรายชื่อผู้เช็คอินไม่สำเร็จ");
    } finally {
      setRosterLoading(false);
    }
  }, [page, checkoutFilter, debouncedQ]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster, listNonce]);

  async function handleCheckin() {
    const trimmed = q.trim();
    if (!trimmed) {
      setError("กรุณากรอก booking code / เบอร์ / ชื่อเพื่อเช็คอิน");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/bookings/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed })
      });
      const data = (await response.json()) as CheckinResult;
      if (!response.ok) {
        setError(data.message || "เช็คอินไม่สำเร็จ");
      }
      setResult(data);
      if (response.ok) {
        setPage(1);
        setListNonce((n) => n + 1);
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setLoading(false);
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Onsite Check-in</h1>

      <section className="admin-panel mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-stretch">
          <div className="relative min-w-0 flex-1 lg:min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              className={`${kanit.className} w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900`}
              placeholder="ค้นหา ชื่อ / เบอร์ / booking code — ใช้ทั้งกรองตารางและกดเช็คอิน"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="relative min-w-[11.5rem] lg:min-w-[16rem]">
            <select
              className={`${kanit.className} h-full w-full cursor-pointer appearance-none rounded-xl border border-zinc-300 bg-white py-2 pl-3 pr-10 text-sm text-zinc-900`}
              value={checkoutFilter}
              onChange={(event) => setCheckoutFilter(event.target.value)}
            >
              {CHECKOUT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
          </div>
          <button
            type="button"
            onClick={() => void loadRoster()}
            className={`${kanit.className} inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50`}
          >
            <RefreshCw className={`h-4 w-4 ${rosterLoading ? "animate-spin" : ""}`} />
            โหลดใหม่
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleCheckin()}
            className={`${kanit.className} inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60 lg:min-w-[9rem]`}
          >
            <SearchCheck className="h-4 w-4" />
            {loading ? "กำลังเช็ค..." : "เช็คอิน"}
          </button>
        </div>
      </section>

      {error && (
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-red-600">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </p>
      )}

      {result?.booking && (
        <section className="admin-panel mb-4 p-4 text-sm">
          <p>ผลลัพธ์: {result.message}</p>
          <p>ชื่อ: {result.booking.fullName}</p>
          <p>รหัสจอง: {result.booking.bookingCode ?? "-"}</p>
          <p>สถานะ: {bookingStatusLabel(result.booking.status)}</p>
          <p>เวลาเช็คอิน: {result.booking.checkedInAt ? new Date(result.booking.checkedInAt).toLocaleString("th-TH") : "-"}</p>
          <p>จำนวนแก้ว: {result.booking.drinkCount ?? 0}</p>
          <p>
            เวลาเช็คเอาท์:{" "}
            {result.booking.checkedOutAt ? new Date(result.booking.checkedOutAt).toLocaleString("th-TH") : "-"}
          </p>
        </section>
      )}

      <section className="admin-panel overflow-x-auto">
        <table className="min-w-[880px] w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-3">รหัสจอง</th>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">เบอร์</th>
              <th className="px-4 py-3">LINE</th>
              <th className="px-4 py-3">เวลาเช็คอิน</th>
              <th className="px-4 py-3 text-center">แก้ว</th>
              <th className="px-4 py-3 text-center">ในงาน</th>
              <th className="px-4 py-3">เวลาเช็คเอาท์</th>
            </tr>
          </thead>
          <tbody>
            {rosterLoading ? (
              <tr>
                <td className="muted px-4 py-6" colSpan={8}>
                  กำลังโหลดรายชื่อ…
                </td>
              </tr>
            ) : rosterError ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-red-600" colSpan={8}>
                  {rosterError}
                </td>
              </tr>
            ) : roster.length === 0 ? (
              <tr>
                <td className="muted px-4 py-8 text-center" colSpan={8}>
                  ไม่พบรายการตามเงื่อนไข
                </td>
              </tr>
            ) : (
              roster.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium">{row.bookingCode ?? "-"}</td>
                  <td className="px-4 py-3">{row.fullName}</td>
                  <td className="px-4 py-3">{row.phone}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.lineDisplay ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.checkedInAt ? new Date(row.checkedInAt).toLocaleString("th-TH") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{row.drinkCount ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {row.checkedOutAt != null && row.checkedOutAt !== "" ? (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        เช็คเอาท์แล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        อยู่ในงาน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.checkedOutAt != null && row.checkedOutAt !== ""
                      ? new Date(row.checkedOutAt).toLocaleString("th-TH")
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!rosterLoading && !rosterError && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <p className={kanit.className}>
              แสดง {rangeFrom}–{rangeTo} จาก {total} รายการ · หน้า {page}/{maxPage}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                ก่อนหน้า
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              >
                ถัดไป
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
