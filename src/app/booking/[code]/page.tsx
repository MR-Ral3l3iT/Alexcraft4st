import { bookingStatusLabel } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { BadgeCheck, QrCode, TicketX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type BookingCodePageProps = {
  params: Promise<{ code: string }>;
};

export default async function BookingCodePage({ params }: BookingCodePageProps) {
  const { code } = await params;
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      bookingCode: true,
      fullName: true,
      seats: true,
      status: true,
      qrCodePayload: true
    }
  });

  if (!booking) notFound();

  const isCancelled = booking.status === "cancelled";
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 inline-flex items-center gap-2 text-xl font-semibold">
          {isCancelled ? (
            <TicketX className="h-5 w-5 text-red-600" />
          ) : (
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
          )}
          รายละเอียดการจอง
        </h1>

        <div className="space-y-1 text-sm text-zinc-700">
          <p>ชื่อ: {booking.fullName}</p>
          <p>รหัสจอง: {booking.bookingCode}</p>
          <p>จำนวนที่นั่ง: {booking.seats}</p>
          <p>สถานะ: {bookingStatusLabel(booking.status)}</p>
        </div>

        {!isCancelled && (
          <div className="mt-5 rounded-xl bg-zinc-50 p-4">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4" />
              QR Payload (สำหรับ demo)
            </p>
            <code className="break-all text-xs">{booking.qrCodePayload ?? "-"}</code>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Link href="/liff/status" className="text-sm text-emerald-700 underline">
          ไปหน้าตรวจสอบสถานะ
        </Link>
      </div>
    </main>
  );
}
