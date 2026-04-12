import Image from "next/image";
import Link from "next/link";

export default function LiffCheckoutPlaceholderPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center text-zinc-100">
      <Image src="/alex-craft-logo.svg" alt="" width={48} height={48} className="mb-4 opacity-90" />
      <h1 className="text-xl font-semibold text-[var(--brand)]">Check out / กลับบ้าน</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
        ฟีเจอร์นี้อยู่ระหว่างพัฒนา — จะบันทึก checkout และสรุปผลในงานเมื่อ Step 13 พร้อม
      </p>
      <Link
        href="/liff/status"
        className="mt-8 rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        กลับไปดูสถานะ
      </Link>
    </main>
  );
}
