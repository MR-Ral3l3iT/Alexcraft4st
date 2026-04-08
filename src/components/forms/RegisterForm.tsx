"use client";

import { UserPlus, ReceiptText, Send, AlertCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type LiffProfile = {
  lineUserId: string;
  displayName: string;
};

type RegisterResponse = {
  id: string;
  bookingCode: string | null;
  status: string;
};

export function RegisterForm() {
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResponse | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState("");
  const [slipUrl, setSlipUrl] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/liff/profile");
        const data = (await response.json()) as LiffProfile;
        setProfile(data);
      } catch {
        setError("ไม่สามารถโหลด LIFF profile ได้");
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, []);

  const canSubmit = useMemo(() => {
    return !!profile?.lineUserId && fullName.trim() && phone.trim() && seats > 0;
  }, [profile?.lineUserId, fullName, phone, seats]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.lineUserId,
          lineDisplay: profile.displayName,
          fullName,
          phone,
          seats,
          note: note || undefined,
          slipUrl: slipUrl || undefined
        })
      });

      const data = (await response.json()) as RegisterResponse & { message?: string };
      if (!response.ok) {
        setError(data.message || "ลงทะเบียนไม่สำเร็จ");
        return;
      }

      setResult(data);
      setMessage("ลงทะเบียนสำเร็จ");
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างส่งข้อมูล");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">ลงทะเบียนเข้างาน</h2>
      </div>

      <div className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm">
        {loadingProfile ? "กำลังโหลด LIFF profile..." : `LINE: ${profile?.displayName} (${profile?.lineUserId})`}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">ชื่อ-นามสกุล</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">เบอร์โทร</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">จำนวนที่นั่ง</span>
          <input
            type="number"
            min={1}
            max={10}
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">ลิงก์สลิป (ถ้ามี)</span>
          <div className="relative">
            <ReceiptText className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={slipUrl}
              onChange={(event) => setSlipUrl(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3"
              placeholder="https://..."
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">หมายเหตุ</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            rows={3}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? "กำลังส่ง..." : "ยืนยันลงทะเบียน"}
        </button>
      </form>

      {error && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
      {message && result && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {message} (code: {result.bookingCode ?? "-"}, status: {result.status})
        </div>
      )}
    </div>
  );
}
