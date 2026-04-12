"use client";

import { useState } from "react";

type PaymentSlipFormProps = {
  bookingCode: string;
  initialSlipUrl: string | null;
  initialStatus: "pending" | "waiting_payment_review" | "confirmed" | "cancelled" | "checked_in";
};

const COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const MAX_DIMENSION = 1600;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function hashFile(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function compressImageFile(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      img.src = objectUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.82);
    });
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "slip";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function PaymentSlipForm({ bookingCode, initialSlipUrl, initialStatus }: PaymentSlipFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedSlipUrl, setUploadedSlipUrl] = useState(initialSlipUrl ?? "");
  const [lastUploadedHash, setLastUploadedHash] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isDisabled = status === "cancelled" || status === "checked_in";

  const slipSectionTitle =
    status === "waiting_payment_review" || uploadedSlipUrl
      ? "ส่งหลักฐานการชำระเงินใหม่"
      : "ส่งหลักฐานชำระเงิน";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    if (!selectedFile) {
      setError("กรุณาแนบไฟล์สลิปก่อนส่ง");
      setSubmitting(false);
      return;
    }

    try {
      const processedFile = await compressImageFile(selectedFile);
      const slipHash = await hashFile(processedFile);
      if (slipHash === lastUploadedHash) {
        setError("ไฟล์นี้ถูกส่งไปแล้ว กรุณาเลือกไฟล์ใหม่");
        return;
      }

      const formData = new FormData();
      formData.append("slipFile", processedFile);
      const response = await fetch(`/api/bookings/code/${encodeURIComponent(bookingCode)}/submit-slip`, {
        method: "POST",
        headers: {
          "x-slip-hash": slipHash
        },
        body: formData
      });

      const data = (await response.json()) as {
        status?: PaymentSlipFormProps["initialStatus"];
        message?: string;
        slipUrl?: string;
      };
      if (!response.ok) {
        setError(data.message ?? "ส่งสลิปไม่สำเร็จ");
        return;
      }

      setStatus(data.status ?? status);
      if (data.slipUrl) setUploadedSlipUrl(data.slipUrl);
      setLastUploadedHash(slipHash);
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setMessage(
        data.status === "waiting_payment_review" || status === "pending"
          ? "ส่งสลิปแล้ว ระบบรอตรวจสอบชำระเงิน"
          : "อัปเดตสลิปสำเร็จ"
      );
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างส่งสลิป");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-2 text-sm font-semibold text-zinc-900">{slipSectionTitle}</p>
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          key={fileInputKey}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          disabled={isDisabled || submitting}
        />
        {selectedFile ? <p className="text-xs text-zinc-600">ไฟล์ที่เลือก: {selectedFile.name}</p> : null}
        {uploadedSlipUrl ? (
          <p className="text-xs text-zinc-600">
            แนบล่าสุด:{" "}
            <a href={uploadedSlipUrl} target="_blank" rel="noreferrer" className="underline">
              เปิดดูสลิป
            </a>
          </p>
        ) : null}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isDisabled || submitting || !selectedFile}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันการชำระเงิน"}
          </button>
        </div>
      </form>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
