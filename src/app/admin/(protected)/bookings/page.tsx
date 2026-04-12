"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { liffProfileImageSrc } from "@/lib/liff-profile-image";
import { canTransition } from "@/lib/booking-rules";
import type { BookingStatus } from "@prisma/client";
import { kanit } from "@/fonts";
import { Ban, Check, ChevronDown, ChevronLeft, ChevronRight, ImageIcon, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

type BookingRow = {
  id: string;
  bookingCode: string | null;
  lineDisplay: string | null;
  linePictureUrl: string | null;
  fullName: string;
  phone: string;
  seats: number;
  status: BookingStatus;
  slipUrl: string | null;
};

type SlipPreview = {
  url: string;
  bookingCode: string | null;
  fullName: string;
};

type PendingConfirm =
  | { type: "reject-slip"; id: string; bookingCode: string | null; fullName: string }
  | {
      type: "cancel";
      id: string;
      bookingCode: string | null;
      fullName: string;
      variant: "while_review" | "default";
    };

const ADMIN_STATUS_FILTER_OPTIONS: BookingStatus[] = [
  "pending",
  "waiting_payment_review",
  "confirmed",
  "cancelled",
  "checked_in"
];

const PAGE_SIZE = 20;

type BookingsListResponse = {
  bookings: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
};

function actionButtonClass(disabled: boolean) {
  return `rounded-lg border border-zinc-200 p-2 ${disabled ? "cursor-not-allowed opacity-40" : "hover:bg-zinc-50"}`;
}

function bookingAvatarInitial(row: BookingRow) {
  const fromName = row.fullName?.trim();
  if (fromName) return fromName.charAt(0).toUpperCase();
  const fromLine = row.lineDisplay?.trim();
  if (fromLine) return fromLine.charAt(0).toUpperCase();
  return "?";
}

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [slipPreview, setSlipPreview] = useState<SlipPreview | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => window.clearTimeout(id);
  }, [q]);

  useLayoutEffect(() => {
    setPage(1);
  }, [status, debouncedQ]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (debouncedQ) params.set("q", debouncedQ);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const response = await fetch(`/api/bookings?${params.toString()}`);
    const payload = (await response.json()) as BookingsListResponse;
    const maxPage = Math.max(1, Math.ceil(payload.total / payload.pageSize));
    if (page > maxPage) {
      setPage(maxPage);
      setLoading(false);
      return;
    }
    setRows(payload.bookings);
    setTotal(payload.total);
    setLoading(false);
  }, [status, debouncedQ, page]);

  const postBookingAction = useCallback(
    async (id: string, endpoint: "approve" | "cancel" | "reject-slip"): Promise<boolean> => {
      const res = await fetch(`/api/bookings/${id}/${endpoint}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        window.alert(body?.message ?? `คำขอล้มเหลว (${res.status})`);
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!slipPreview) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSlipPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slipPreview]);

  useEffect(() => {
    if (!pendingConfirm || confirmSubmitting) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingConfirm(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingConfirm, confirmSubmitting]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  async function handleConfirmAction() {
    if (!pendingConfirm) return;
    const endpoint = pendingConfirm.type === "reject-slip" ? "reject-slip" : "cancel";
    setConfirmSubmitting(true);
    const ok = await postBookingAction(pendingConfirm.id, endpoint);
    setConfirmSubmitting(false);
    if (ok) setPendingConfirm(null);
  }

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Bookings</h1>
      <section className="admin-panel mb-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              className={`${kanit.className} w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900`}
              placeholder="ค้นหา ชื่อ / เบอร์ / booking code"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="relative min-w-[11.5rem] md:min-w-[13rem]">
            <select
              className={`${kanit.className} w-full cursor-pointer appearance-none rounded-xl border border-zinc-300 bg-white py-2 pl-3 pr-10 text-sm text-zinc-900`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              {ADMIN_STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {bookingStatusLabel(s)}
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
            onClick={() => void load()}
            className={`${kanit.className} rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white`}
          >
            โหลดใหม่
          </button>
        </div>
      </section>

      <section className="admin-panel overflow-x-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="w-14 px-2 py-3 text-center">
                <span className="sr-only">รูปโปรไฟล์</span>
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">สิทธิ์</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 muted" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 muted text-center" colSpan={7}>
                  ไม่พบรายการ
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const canOpenSlip = Boolean(row.slipUrl);
                const canApprove = canTransition(row.status, "confirmed");
                const canRejectSlip = row.status === "waiting_payment_review" && canTransition(row.status, "pending");
                const canCancelBooking = canTransition(row.status, "cancelled");

                const profileSrc = liffProfileImageSrc(row.linePictureUrl);
                return (
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{row.bookingCode ?? "-"}</td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex justify-center">
                        {profileSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element -- proxied LINE CDN URL
                          <img
                            src={profileSrc}
                            alt=""
                            className={`${kanit.className} h-9 w-9 rounded-full border border-zinc-200 object-cover`}
                            width={36}
                            height={36}
                          />
                        ) : (
                          <div
                            className={`${kanit.className} flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600`}
                            aria-hidden
                          >
                            {bookingAvatarInitial(row)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.fullName}</td>
                    <td className="px-4 py-3">{row.phone}</td>
                    <td className="px-4 py-3">{row.seats} ที่</td>
                    <td className="px-4 py-3">{bookingStatusLabel(row.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canOpenSlip && row.slipUrl ? (
                          <button
                            type="button"
                            title="ดูสลิป"
                            className={`${actionButtonClass(false)} inline-flex text-zinc-800`}
                            onClick={() =>
                              setSlipPreview({
                                url: row.slipUrl!,
                                bookingCode: row.bookingCode,
                                fullName: row.fullName
                              })
                            }
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <span title="ยังไม่มีสลิปในระบบ" className={`${actionButtonClass(true)} inline-flex text-zinc-400`}>
                            <ImageIcon className="h-4 w-4" />
                          </span>
                        )}
                        <button
                          type="button"
                          title="อนุมัติชำระเงิน (รอตรวจสลิป)"
                          disabled={!canApprove}
                          className={actionButtonClass(!canApprove)}
                          onClick={() => {
                            if (!canApprove) return;
                            void postBookingAction(row.id, "approve");
                          }}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </button>
                        <button
                          type="button"
                          title={
                            canRejectSlip
                              ? "สลิปไม่ถูกต้อง — คืนเป็นสถานะรอชำระและให้อัปโหลดใหม่"
                              : canCancelBooking
                                ? "ยกเลิกการจอง"
                                : "ไม่สามารถยกเลิกหรือปฏิเสธสลิปในสถานะนี้"
                          }
                          disabled={!canRejectSlip && !canCancelBooking}
                          className={actionButtonClass(!canRejectSlip && !canCancelBooking)}
                          onClick={() => {
                            if (canRejectSlip) {
                              setPendingConfirm({
                                type: "reject-slip",
                                id: row.id,
                                bookingCode: row.bookingCode,
                                fullName: row.fullName
                              });
                              return;
                            }
                            if (canCancelBooking) {
                              setPendingConfirm({
                                type: "cancel",
                                id: row.id,
                                bookingCode: row.bookingCode,
                                fullName: row.fullName,
                                variant: "default"
                              });
                            }
                          }}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </button>
                        {row.status === "waiting_payment_review" && canCancelBooking ? (
                          <button
                            type="button"
                            title="ยกเลิกการจองทั้งหมด — สถานะ cancelled (ไม่ใช่แค่ปฏิเสธสลิป)"
                            className={actionButtonClass(false)}
                            onClick={() =>
                              setPendingConfirm({
                                type: "cancel",
                                id: row.id,
                                bookingCode: row.bookingCode,
                                fullName: row.fullName,
                                variant: "while_review"
                              })
                            }
                          >
                            <Ban className="h-4 w-4 text-amber-700" />
                          </button>
                        ) : null}
                        <Link href={`/admin/bookings/${row.id}`} className="rounded-lg border border-zinc-200 px-3 py-1.5">
                          Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && total > 0 ? (
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

      {slipPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="slip-preview-title">
          <button
            type="button"
            aria-label="ปิดหน้าต่าง"
            className="absolute inset-0 bg-black/55"
            onClick={() => setSlipPreview(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 id="slip-preview-title" className="text-base font-semibold text-zinc-900">
                  สลิปการโอน
                </h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {slipPreview.fullName}
                  {slipPreview.bookingCode ? ` · ${slipPreview.bookingCode}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50"
                aria-label="ปิด"
                onClick={() => setSlipPreview(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-zinc-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic slip URL from storage */}
              <img src={slipPreview.url} alt="สลิปการโอน" className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm" />
            </div>
          </div>
        </div>
      ) : null}

      {pendingConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <button
            type="button"
            aria-label="ปิด"
            className="absolute inset-0 bg-black/55"
            onClick={() => !confirmSubmitting && setPendingConfirm(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-zinc-900">
              {pendingConfirm.type === "reject-slip" ? "ยืนยันปฏิเสธสลิป" : "ยืนยันยกเลิกการจอง"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {pendingConfirm.type === "reject-slip" ? (
                <>
                  จะคืนสถานะเป็น <strong>รอชำระเงิน</strong> ลบสลิปในระบบ และแจ้งลูกค้าให้อัปโหลดสลิปใหม่
                  <br />
                  <span className="mt-2 inline-block text-zinc-800">
                    {pendingConfirm.fullName}
                    {pendingConfirm.bookingCode ? ` · ${pendingConfirm.bookingCode}` : ""}
                  </span>
                </>
              ) : pendingConfirm.variant === "while_review" ? (
                <>
                  ยกเลิก<strong>การจองทั้งรายการ</strong> (สถานะ <strong>cancelled</strong>) ไม่ใช่แค่ให้ส่งสลิปใหม่
                  <br />
                  <span className="mt-2 inline-block text-zinc-800">
                    {pendingConfirm.fullName}
                    {pendingConfirm.bookingCode ? ` · ${pendingConfirm.bookingCode}` : ""}
                  </span>
                </>
              ) : (
                <>
                  การจองจะถูกยกเลิก (สถานะ <strong>cancelled</strong>) และแจ้งลูกค้าทาง LINE
                  <br />
                  <span className="mt-2 inline-block text-zinc-800">
                    {pendingConfirm.fullName}
                    {pendingConfirm.bookingCode ? ` · ${pendingConfirm.bookingCode}` : ""}
                  </span>
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                disabled={confirmSubmitting}
                onClick={() => setPendingConfirm(null)}
              >
                กลับ
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                  pendingConfirm.type === "reject-slip" ? "bg-red-600 hover:bg-red-700" : "bg-amber-800 hover:bg-amber-900"
                }`}
                disabled={confirmSubmitting}
                onClick={() => void handleConfirmAction()}
              >
                {confirmSubmitting ? "กำลังดำเนินการ…" : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
