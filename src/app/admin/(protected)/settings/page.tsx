"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SettingsResponse = {
  capacity: number;
  venueLat: number | null;
  venueLng: number | null;
  checkinRadiusM: number;
  checkinStartAt: string | null;
  checkinEndAt: string | null;
  drinkCooldownSec: number;
  drinkMaxPerUser: number;
  paymentAmountThb: number;
  paymentAccountNo: string | null;
  paymentBankName: string | null;
  paymentAccountName: string | null;
};

function toLocalDatetimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [capacity, setCapacity] = useState(40);
  const [venueLat, setVenueLat] = useState("");
  const [venueLng, setVenueLng] = useState("");
  const [checkinRadiusM, setCheckinRadiusM] = useState(100);
  const [checkinStartAt, setCheckinStartAt] = useState("");
  const [checkinEndAt, setCheckinEndAt] = useState("");
  const [drinkCooldownSec, setDrinkCooldownSec] = useState(600);
  const [drinkMaxPerUser, setDrinkMaxPerUser] = useState(10);
  const [paymentAmountThb, setPaymentAmountThb] = useState(799);
  const [paymentAccountNo, setPaymentAccountNo] = useState("");
  const [paymentBankName, setPaymentBankName] = useState("");
  const [paymentAccountName, setPaymentAccountName] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/settings");
        const data = (await response.json()) as SettingsResponse & { message?: string };
        if (!response.ok) {
          setError(data.message ?? "โหลดค่าตั้งค่าไม่สำเร็จ");
          return;
        }
        setCapacity(data.capacity);
        setVenueLat(data.venueLat?.toString() ?? "");
        setVenueLng(data.venueLng?.toString() ?? "");
        setCheckinRadiusM(data.checkinRadiusM);
        setCheckinStartAt(toLocalDatetimeInput(data.checkinStartAt));
        setCheckinEndAt(toLocalDatetimeInput(data.checkinEndAt));
        setDrinkCooldownSec(data.drinkCooldownSec);
        setDrinkMaxPerUser(data.drinkMaxPerUser);
        setPaymentAmountThb(data.paymentAmountThb ?? 799);
        setPaymentAccountNo(data.paymentAccountNo ?? "");
        setPaymentBankName(data.paymentBankName ?? "");
        setPaymentAccountName(data.paymentAccountName ?? "");
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างโหลดค่าตั้งค่า");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const mapLink = useMemo(() => {
    if (!venueLat || !venueLng) return "";
    return `https://maps.google.com/?q=${encodeURIComponent(`${venueLat},${venueLng}`)}`;
  }, [venueLat, venueLng]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacity,
          venueLat: venueLat.trim() ? Number(venueLat) : null,
          venueLng: venueLng.trim() ? Number(venueLng) : null,
          checkinRadiusM,
          checkinStartAt: checkinStartAt ? new Date(checkinStartAt).toISOString() : null,
          checkinEndAt: checkinEndAt ? new Date(checkinEndAt).toISOString() : null,
          drinkCooldownSec,
          drinkMaxPerUser,
          paymentAmountThb,
          paymentAccountNo: paymentAccountNo.trim() || null,
          paymentBankName: paymentBankName.trim() || null,
          paymentAccountName: paymentAccountName.trim() || null
        })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "บันทึกค่าตั้งค่าไม่สำเร็จ");
        return;
      }
      setMessage("บันทึกค่าตั้งค่าสำเร็จ");
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างบันทึกค่าตั้งค่า");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Event Settings</h1>
      <section className="admin-panel p-4">
        {loading ? (
          <p className="text-sm muted">Loading settings...</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm">Capacity (จำนวนผู้เข้ารวม)</span>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Check-in Radius (meters)</span>
              <input
                type="number"
                min={10}
                value={checkinRadiusM}
                onChange={(event) => setCheckinRadiusM(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Venue Latitude</span>
              <input
                value={venueLat}
                onChange={(event) => setVenueLat(event.target.value)}
                placeholder="เช่น 13.7563"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Venue Longitude</span>
              <input
                value={venueLng}
                onChange={(event) => setVenueLng(event.target.value)}
                placeholder="เช่น 100.5018"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Check-in Start</span>
              <input
                type="datetime-local"
                value={checkinStartAt}
                onChange={(event) => setCheckinStartAt(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Check-in End</span>
              <input
                type="datetime-local"
                value={checkinEndAt}
                onChange={(event) => setCheckinEndAt(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Drink Cooldown (seconds)</span>
              <input
                type="number"
                min={0}
                value={drinkCooldownSec}
                onChange={(event) => setDrinkCooldownSec(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Drink Max Per User</span>
              <input
                type="number"
                min={0}
                value={drinkMaxPerUser}
                onChange={(event) => setDrinkMaxPerUser(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Payment Amount (THB)</span>
              <input
                type="number"
                min={0}
                value={paymentAmountThb}
                onChange={(event) => setPaymentAmountThb(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Payment Account No.</span>
              <input
                value={paymentAccountNo}
                onChange={(event) => setPaymentAccountNo(event.target.value)}
                placeholder="เช่น 0123456789"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Bank Name (ชื่อธนาคาร)</span>
              <input
                value={paymentBankName}
                onChange={(event) => setPaymentBankName(event.target.value)}
                placeholder="เช่น กสิกรไทย"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Account Name (ชื่อบัญชี)</span>
              <input
                value={paymentAccountName}
                onChange={(event) => setPaymentAccountName(event.target.value)}
                placeholder="เช่น Alexcraft Event Co., Ltd."
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกค่าตั้งค่า"}
              </button>
              {mapLink ? (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[var(--brand)] underline"
                >
                  เปิดตำแหน่งในแผนที่
                </a>
              ) : null}
            </div>
            {message ? <p className="md:col-span-2 text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}
