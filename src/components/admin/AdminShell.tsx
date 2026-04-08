import { Bell, CalendarDays, ChartNoAxesCombined, QrCode, Ticket } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import Link from "next/link";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/admin/bookings", label: "Bookings", icon: Ticket },
  { href: "/admin/checkin", label: "Check-in", icon: QrCode }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar flex flex-col items-center gap-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
          <CalendarDays className="h-5 w-5" />
        </div>
        <nav className="flex flex-col gap-4">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              title={item.label}
            >
              <item.icon className="h-4 w-4" />
            </Link>
          ))}
        </nav>
        <AdminLogoutButton />
      </aside>

      <div className="p-6">
        <header className="admin-panel mb-4 flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-medium">Alexcraft Admin</p>
            <p className="text-xs muted">Booking + Check-in Console</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-zinc-200 p-2">
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
