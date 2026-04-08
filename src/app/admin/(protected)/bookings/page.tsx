"use client";

import { bookingStatusLabel } from "@/lib/booking";
import { Check, Search, X, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type BookingRow = {
  id: string;
  bookingCode: string | null;
  fullName: string;
  phone: string;
  seats: number;
  status: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
};

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const response = await fetch(`/api/bookings?${params.toString()}`);
    const data = (await response.json()) as BookingRow[];
    setRows(data);
    setLoading(false);
  }

  async function action(id: string, endpoint: "approve" | "cancel" | "mark-paid") {
    await fetch(`/api/bookings/${id}/${endpoint}`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Bookings</h1>
      <section className="admin-panel mb-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3"
              placeholder="ค้นหา ชื่อ / เบอร์ / booking code"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-zinc-300 px-3 py-2"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            <option value="pending">pending</option>
            <option value="waiting_payment_review">waiting_payment_review</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
            <option value="checked_in">checked_in</option>
          </select>
          <button onClick={() => void load()} className="rounded-xl bg-[var(--brand)] px-4 py-2 text-white">
            Filter
          </button>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 muted" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{row.bookingCode ?? "-"}</td>
                  <td className="px-4 py-3">{row.fullName}</td>
                  <td className="px-4 py-3">{row.phone}</td>
                  <td className="px-4 py-3">{row.seats}</td>
                  <td className="px-4 py-3">{bookingStatusLabel(row.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-lg border border-zinc-200 p-2" onClick={() => void action(row.id, "mark-paid")}>
                        <Wallet className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-zinc-200 p-2" onClick={() => void action(row.id, "approve")}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </button>
                      <button className="rounded-lg border border-zinc-200 p-2" onClick={() => void action(row.id, "cancel")}>
                        <X className="h-4 w-4 text-red-600" />
                      </button>
                      <Link href={`/admin/bookings/${row.id}`} className="rounded-lg border border-zinc-200 px-3 py-1.5">
                        Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
