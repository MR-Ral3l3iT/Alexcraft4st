"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message || "Login failed");
      setLoading(false);
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <section className="admin-panel w-full p-6">
        <h1 className="mb-1 text-xl font-semibold">Admin Login</h1>
        <p className="mb-4 text-sm muted">Demo login เพื่อเข้าใช้งานหลังบ้าน</p>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm">Email</span>
            <div className="relative">
              <UserRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Password</span>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </label>
          <button className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2 font-medium text-white">
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </section>
    </main>
  );
}
