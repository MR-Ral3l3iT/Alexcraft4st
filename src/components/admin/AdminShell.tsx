"use client";

import { useState } from "react";
import { Bell, ChartNoAxesCombined, Gift, Menu, QrCode, Settings, Ticket, X } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/admin/bookings", label: "Bookings", icon: Ticket },
  { href: "/admin/checkin", label: "Check-in", icon: QrCode },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = menu.map((item) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition md:h-10 md:w-10 md:justify-center md:gap-0 md:px-0 md:py-0 ${
          isActive
            ? "bg-[var(--brand)] text-white"
            : "text-zinc-300 hover:bg-[var(--brand)] hover:text-white"
        }`}
        title={item.label}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="md:hidden">{item.label}</span>
      </Link>
    );
  });

  return (
    <div className="admin-shell">
      {/* ── Mobile top bar ── */}
      <div className="admin-sidebar flex items-center justify-between px-4 py-3 md:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1">
          <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={36} height={36} className="h-auto" />
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="rounded-xl p-2 text-white transition hover:bg-white/10"
          aria-label="เปิดเมนู"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 right-0 z-40 flex flex-col gap-1 bg-[var(--sidebar)] px-3 py-3 shadow-lg md:hidden">
            {navLinks}
            <div className="mt-2 border-t border-white/10 pt-3">
              <AdminLogoutButton />
            </div>
          </div>
        </>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="admin-sidebar hidden md:flex md:flex-col md:items-center md:gap-6 md:py-6">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-1">
          <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={36} height={36} className="h-auto" />
        </div>
        <nav className="flex flex-col items-center gap-4">
          {navLinks}
        </nav>
        <div className="mt-auto">
          <AdminLogoutButton />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1 p-4 md:p-6">
        <header className="admin-panel mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Alexcraft Admin</p>
            <p className="truncate text-xs muted">Booking + Check-in Console</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" className="rounded-xl border border-zinc-200 p-2" aria-label="การแจ้งเตือน">
              <Bell className="h-4 w-4" />
            </button>
            <div className="accent-chip rounded-full px-3 py-1 text-xs font-semibold">Hi, Admin</div>
            <AdminLogoutButton compact />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
