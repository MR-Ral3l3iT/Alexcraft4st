import { bookingStatusLabel } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { Clock3, Ticket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" } },
      checkinLogs: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!booking) notFound();

  return (
    <main className="space-y-4">
      <section className="admin-panel p-5">
        <h1 className="mb-3 inline-flex items-center gap-2 text-xl font-semibold">
          <Ticket className="h-5 w-5 text-[var(--brand)]" />
          Booking Detail
        </h1>
        <div className="space-y-1 text-sm">
          <p>ชื่อ: {booking.fullName}</p>
          <p>เบอร์: {booking.phone}</p>
          <p>LINE User: {booking.lineUserId}</p>
          <p>รหัสจอง: {booking.bookingCode ?? "-"}</p>
          <p>สถานะ: {bookingStatusLabel(booking.status)}</p>
          <p>จำนวนที่นั่ง: {booking.seats}</p>
          <p>หมายเหตุ: {booking.note ?? "-"}</p>
        </div>
        <Link href="/admin/bookings" className="mt-3 inline-block text-sm text-[var(--brand)] underline">
          กลับไปหน้า bookings
        </Link>
      </section>

      <section className="admin-panel p-5">
        <h2 className="mb-2 inline-flex items-center gap-2 text-base font-semibold">
          <Clock3 className="h-4 w-4 text-zinc-600" />
          Status History
        </h2>
        <div className="space-y-2 text-sm">
          {booking.statusLogs.length === 0 && <p className="muted">ไม่มีประวัติสถานะ</p>}
          {booking.statusLogs.map((log) => (
            <div key={log.id} className="rounded-lg bg-zinc-50 px-3 py-2">
              <p>
                {bookingStatusLabel(log.fromStatus ?? "pending")} → {bookingStatusLabel(log.toStatus)}
              </p>
              <p className="text-xs muted">{new Date(log.createdAt).toLocaleString("th-TH")}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
