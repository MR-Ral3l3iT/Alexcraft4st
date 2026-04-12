"use client";

import { useState } from "react";

type PaymentQrCardProps = {
  bookingCode: string;
  initialAmount: number | null;
  initialRef: string | null;
  initialImageUrl: string | null;
  initialExpiresAt: string | Date | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNo?: string | null;
};

export function PaymentQrCard(props: PaymentQrCardProps) {
  const { initialAmount: amount, initialImageUrl: imageUrl } = props;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function downloadQrImage() {
    if (!imageUrl) {
      setError("ยังไม่มี QR สำหรับบันทึก");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        setError("ไม่สามารถดาวน์โหลด QR ได้");
        return;
      }
      const blob = await res.blob();

      const file = new File([blob], `alexcraft-payment-qr-${props.bookingCode}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Alexcraft Payment QR",
          text: "บันทึก QR ชำระเงิน"
        });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("ไม่สามารถบันทึก QR ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-2 text-sm font-medium">QR ชำระเงิน (PromptPay)</p>

      {imageUrl ? (
        <div className="mt-2 flex justify-center">
          <img
            src={imageUrl}
            alt="PromptPay QR"
            width={220}
            height={220}
            className="rounded-lg border border-zinc-200 bg-white p-2"
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-600">ยังไม่มี QR ชำระเงิน</p>
      )}

      <div className="mt-3 space-y-1 text-center">
        <p className="text-lg font-semibold text-zinc-900">
          ยอดชำระ: {(amount ?? 0).toLocaleString("th-TH")} บาท
        </p>
        {props.bankName ? <p className="text-sm text-zinc-700">ธนาคาร: {props.bankName}</p> : null}
        {props.accountName ? <p className="text-sm text-zinc-700">ชื่อบัญชี: {props.accountName}</p> : null}
        {props.accountNo ? <p className="text-sm text-zinc-700">เลขที่บัญชี: {props.accountNo}</p> : null}
        <p className="text-xs text-red-600 font-medium">* กรุณาระบุจำนวนเงินให้ตรงตามยอดชำระ</p>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => void downloadQrImage()}
          disabled={!imageUrl || saving}
          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก QR"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
