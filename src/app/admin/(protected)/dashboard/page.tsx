import { prisma } from "@/lib/prisma";
import { CheckCircle2, Clock3, Tickets, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [pending, confirmed, checkedIn, total] = await Promise.all([
    prisma.booking.count({ where: { status: { in: ["pending", "waiting_payment_review"] } } }),
    prisma.booking.count({ where: { status: "confirmed" } }),
    prisma.booking.count({ where: { status: "checked_in" } }),
    prisma.booking.count()
  ]);

  const stats = [
    { label: "Pending", value: pending, icon: Clock3, accent: "text-amber-600" },
    { label: "Confirmed", value: confirmed, icon: CheckCircle2, accent: "text-emerald-600" },
    { label: "Checked-in", value: checkedIn, icon: Users, accent: "text-indigo-600" },
    { label: "Total", value: total, icon: Tickets, accent: "text-[var(--brand)]" }
  ];

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="admin-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm muted">{item.label}</p>
              <item.icon className={`h-4 w-4 ${item.accent}`} />
            </div>
            <p className="text-3xl font-semibold">{item.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
