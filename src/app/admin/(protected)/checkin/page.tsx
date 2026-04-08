"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { QrCode, SearchCheck, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";

type CheckinResult = {
  message: string;
  booking?: {
    fullName: string;
    bookingCode: string | null;
    status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
    checkedInAt: string | null;
  };
};

export default function CheckinPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/bookings/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      const data = (await response.json()) as CheckinResult;
      if (!response.ok) {
        setError(data.message || "เช็คอินไม่สำเร็จ");
      }
      setResult(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Onsite Check-in</h1>
      <section className="admin-panel p-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="กรอก booking code / เบอร์ / ชื่อ"
              className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3"
              required
            />
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-white" type="submit">
            <SearchCheck className="h-4 w-4" />
            {loading ? "กำลังเช็ค..." : "เช็คอิน"}
          </button>
        </form>
      </section>

      {error && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-red-600">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </p>
      )}

      {result?.booking && (
        <section className="admin-panel mt-4 p-4 text-sm">
          <p>ผลลัพธ์: {result.message}</p>
          <p>ชื่อ: {result.booking.fullName}</p>
          <p>รหัสจอง: {result.booking.bookingCode ?? "-"}</p>
          <p>สถานะ: {bookingStatusLabel(result.booking.status)}</p>
          <p>เวลาเช็คอิน: {result.booking.checkedInAt ? new Date(result.booking.checkedInAt).toLocaleString("th-TH") : "-"}</p>
        </section>
      )}
    </main>
  );
}
