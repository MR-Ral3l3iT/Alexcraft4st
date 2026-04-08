"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { Search, CircleCheck, AlertTriangle } from "lucide-react";
import { FormEvent, useState } from "react";

type BookingStatusResponse = {
  bookingCode: string | null;
  fullName: string;
  seats: number;
  status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
  checkedInAt: string | null;
};

export default function StatusPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingStatusResponse | null>(null);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setBooking(null);

    try {
      const response = await fetch(`/api/bookings?lineUserId=${encodeURIComponent(lineUserId)}`);
      const data = (await response.json()) as BookingStatusResponse & { message?: string };

      if (!response.ok) {
        setError(data.message || "ไม่พบรายการจอง");
        return;
      }

      setBooking(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold">ตรวจสอบสถานะการจอง</h1>

      <form onSubmit={onSearch} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm">LINE User ID</span>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={lineUserId}
              onChange={(event) => setLineUserId(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3"
              placeholder="เช่น demo-line-user"
              required
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
      </form>

      {error && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </p>
      )}

      {booking && (
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="inline-flex items-center gap-2 text-emerald-700">
            <CircleCheck className="h-4 w-4" />
            พบข้อมูลการจอง
          </p>
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            <p>ชื่อ: {booking.fullName}</p>
            <p>รหัสจอง: {booking.bookingCode ?? "-"}</p>
            <p>จำนวนที่นั่ง: {booking.seats}</p>
            <p>สถานะ: {bookingStatusLabel(booking.status)}</p>
            <p>เวลาเช็คอิน: {booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString("th-TH") : "-"}</p>
          </div>
        </section>
      )}
    </main>
  );
}
