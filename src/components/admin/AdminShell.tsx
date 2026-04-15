"use client";

import { Bell, ChartNoAxesCombined, QrCode, Settings, Ticket } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/admin/bookings", label: "Bookings", icon: Ticket },
  { href: "/admin/checkin", label: "Check-in", icon: QrCode },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="admin-shell block md:grid">
      <aside className="admin-sidebar flex items-center justify-between px-4 py-3 md:flex-col md:items-center md:justify-start md:gap-6 md:px-0 md:py-6">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 md:h-11 md:w-11">
          <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={36} height={36} className="h-auto" />
        </div>
        <nav className="flex items-center gap-3 md:flex-col md:gap-4">
          {menu.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isActive
                    ? "bg-[var(--brand)] text-white"
                    : "text-zinc-300 hover:bg-[var(--brand)] hover:text-white"
                }`}
                title={item.label}
              >
                <item.icon className="h-4 w-4" />
              </Link>
            );
          })}
        </nav>
        <div className="md:mt-auto">
          <AdminLogoutButton />
        </div>
      </aside>

      <div className="p-4 md:p-6">
        <header className="admin-panel mb-4 flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-medium">Alexcraft Admin</p>
            <p className="text-xs muted">Booking + Check-in Console</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-xl border border-zinc-200 p-2" aria-label="การแจ้งเตือน">
              <Bell className="h-4 w-4" />
            </button>
            <div className="accent-chip rounded-full px-3 py-1 text-xs font-semibold">Hi, Admin</div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
