"use client";

import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type RewardType = "general" | "coupon";

type RewardRow = {
  id: string;
  code: string;
  name: string;
  type: RewardType;
  quantity: number;
  imageUrl: string;
  couponStartAt: string | null;
  couponEndAt: string | null;
};

type RewardsResponse = {
  rewards: RewardRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
};

const PAGE_SIZE = 10;

function toLocalDatetimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRewardType(type: RewardType): string {
  return type === "coupon" ? "คูปอง" : "รางวัลทั่วไป";
}

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<RewardType>("general");
  const [quantity, setQuantity] = useState(0);
  const [couponStartAt, setCouponStartAt] = useState("");
  const [couponEndAt, setCouponEndAt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const imagePreviewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : ""), [imageFile]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  async function loadRewards() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      const response = await fetch(`/api/admin/rewards?${params.toString()}`);
      const data = (await response.json()) as RewardsResponse;
      if (!response.ok) {
        setError(data.message ?? "โหลดข้อมูลของรางวัลไม่สำเร็จ");
        return;
      }
      const maxPage = Math.max(1, Math.ceil(data.total / data.pageSize));
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }
      setRewards(data.rewards ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างโหลดข้อมูลของรางวัล");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRewards();
  }, [page]);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setType("general");
    setQuantity(0);
    setCouponStartAt("");
    setCouponEndAt("");
    setImageFile(null);
    setFileInputKey((value) => value + 1);
  }

  function startEdit(row: RewardRow) {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setType(row.type);
    setQuantity(row.quantity);
    setCouponStartAt(toLocalDatetimeInput(row.couponStartAt));
    setCouponEndAt(toLocalDatetimeInput(row.couponEndAt));
    setImageFile(null);
    setFileInputKey((value) => value + 1);
    setMessage("");
    setError("");
  }

  function clearSelectedImage() {
    setImageFile(null);
    setFileInputKey((value) => value + 1);
  }

  function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setImageFile(null);
      return;
    }
    if (files.length > 1) {
      setError("อัปโหลดได้ครั้งละ 1 รูปเท่านั้น");
      setImageFile(files[0] ?? null);
      return;
    }
    setImageFile(files[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (!editingId && !imageFile) {
      setError("กรุณาเลือกรูปของรางวัล");
      setSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("code", code.trim().toUpperCase());
      formData.append("name", name.trim());
      formData.append("type", type);
      formData.append("quantity", String(quantity));
      if (imageFile) formData.append("imageFile", imageFile);
      if (type === "coupon") {
        formData.append("couponStartAt", couponStartAt);
        formData.append("couponEndAt", couponEndAt);
      }

      const response = await fetch(editingId ? `/api/admin/rewards/${encodeURIComponent(editingId)}` : "/api/admin/rewards", {
        method: editingId ? "PATCH" : "POST",
        body: formData
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "บันทึกของรางวัลไม่สำเร็จ");
        return;
      }

      setMessage(editingId ? "แก้ไขของรางวัลสำเร็จ" : "เพิ่มของรางวัลสำเร็จ");
      resetForm();
      if (page === 1) {
        await loadRewards();
      } else {
        setPage(1);
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างบันทึกของรางวัล");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const confirmDelete = window.confirm("ยืนยันลบของรางวัลรายการนี้?");
    if (!confirmDelete) return;
    setDeletingId(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/rewards/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "ลบของรางวัลไม่สำเร็จ");
        return;
      }
      if (editingId === id) resetForm();
      setMessage("ลบของรางวัลสำเร็จ");
      await loadRewards();
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างลบของรางวัล");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Rewards</h1>

      <section className="admin-panel mb-4 p-4">
        <h2 className="mb-3 text-lg font-semibold">{editingId ? "แก้ไขของรางวัล" : "เพิ่มของรางวัล"}</h2>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm">รหัสของรางวัล</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="เช่น RW-001"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">ชื่อของรางวัล</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น เสื้อยืด Alexcraft"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">ประเภทของรางวัล</span>
            <div className="relative">
              <select
                value={type}
                onChange={(event) => setType(event.target.value as RewardType)}
                className="w-full appearance-none rounded-xl border border-zinc-300 bg-white py-2 pl-3 pr-10"
              >
                <option value="general">รางวัลทั่วไป</option>
                <option value="coupon">คูปอง</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">จำนวน</span>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              required
            />
          </label>

          {type === "coupon" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm">ระยะเวลาการใช้งาน (เริ่มต้น)</span>
                <input
                  type="datetime-local"
                  value={couponStartAt}
                  onChange={(event) => setCouponStartAt(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">ระยะเวลาการใช้งาน (สิ้นสุด)</span>
                <input
                  type="datetime-local"
                  value={couponEndAt}
                  onChange={(event) => setCouponEndAt(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                  required
                />
              </label>
            </>
          ) : null}

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm">รูปของรางวัล</span>
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onImageChange}
              multiple={false}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              required={!editingId}
            />
            {editingId ? <p className="mt-1 text-xs muted">ถ้าไม่ต้องการเปลี่ยนรูป ให้เว้นช่องนี้ว่างไว้</p> : null}
          </label>

          {imagePreviewUrl ? (
            <div className="md:col-span-2">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview for selected upload file */}
                <img src={imagePreviewUrl} alt="ตัวอย่างรูปของรางวัล" className="h-28 w-28 rounded-xl border border-zinc-200 object-cover" />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute right-1 top-1 rounded-full bg-white/95 p-1 text-red-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-red-50"
                  aria-label="ลบภาพที่เลือก"
                  title="ลบภาพที่เลือก"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--brand)] px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มของรางวัล"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => resetForm()}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm"
              >
                ยกเลิกแก้ไข
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadRewards()}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm"
            >
              โหลดข้อมูลล่าสุด
            </button>
          </div>

          {message ? <p className="md:col-span-2 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </form>
      </section>

      <section className="admin-panel overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-3">รูป</th>
              <th className="px-4 py-3">รหัส</th>
              <th className="px-4 py-3">ชื่อของรางวัล</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">จำนวน</th>
              <th className="px-4 py-3">ช่วงเวลาใช้งานคูปอง</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 muted">
                  Loading...
                </td>
              </tr>
            ) : rewards.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center muted">
                  ยังไม่มีข้อมูลของรางวัล
                </td>
              </tr>
            ) : (
              rewards.map((reward) => (
                <tr key={reward.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- dynamic image URL from local upload */}
                    <img src={reward.imageUrl} alt={reward.name} className="h-14 w-14 rounded-lg border border-zinc-200 object-cover" />
                  </td>
                  <td className="px-4 py-3 font-medium">{reward.code}</td>
                  <td className="px-4 py-3">{reward.name}</td>
                  <td className="px-4 py-3">{formatRewardType(reward.type)}</td>
                  <td className="px-4 py-3">{reward.quantity}</td>
                  <td className="px-4 py-3">
                    {reward.type === "coupon" && reward.couponStartAt && reward.couponEndAt
                      ? `${toLocalDatetimeInput(reward.couponStartAt)} - ${toLocalDatetimeInput(reward.couponEndAt)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(reward)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(reward.id)}
                        disabled={deletingId === reward.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === reward.id ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} จาก {total} รายการ · หน้า {page}/
              {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                ก่อนหน้า
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE))}
                onClick={() => setPage((current) => Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), current + 1))}
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
