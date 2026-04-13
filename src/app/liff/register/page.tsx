import { RegisterForm } from "@/components/forms/RegisterForm";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4 sm:p-6">
      <div className="w-full max-w-3xl">
        <Suspense fallback={<div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">กำลังโหลดแบบฟอร์ม...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </main>
  );
}
