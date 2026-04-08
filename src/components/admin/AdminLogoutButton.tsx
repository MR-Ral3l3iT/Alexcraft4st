"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={onLogout}
      className="mt-auto flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
      title="Logout"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
