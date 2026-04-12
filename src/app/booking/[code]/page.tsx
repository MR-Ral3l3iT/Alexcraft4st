import { bookingStatusLabel } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getEffectiveEventSettings } from "@/lib/event-settings";
import { PaymentQrCard } from "@/components/booking/PaymentQrCard";
import { PaymentSlipForm } from "@/components/booking/PaymentSlipForm";
import { BadgeCheck, TicketX } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

type BookingCodePageProps = {
  params: Promise<{ code: string }>;
};

export default async function BookingCodePage({ params }: BookingCodePageProps) {
  const { code } = await params;
  const settings = await getEffectiveEventSettings();
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      bookingCode: true,
      fullName: true,
      seats: true,
      status: true,
      qrCodePayload: true,
      paymentAmount: true,
      paymentRef: true,
      paymentQrImageUrl: true,
      paymentExpiresAt: true,
      slipUrl: true
    }
  });

  if (!booking) notFound();

  const isCancelled = booking.status === "cancelled";
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 admin-panel flex items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-base font-semibold sm:text-lg">ยืนยันการจอง</h1>
        <Image src="/alex-craft-logo.svg" alt="Alex Craft Logo" width={34} height={34} className="h-auto" />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm sm:p-6">
        <h1 className="mb-4 inline-flex items-center gap-2 text-xl font-semibold">
          {isCancelled ? (
            <TicketX className="h-5 w-5 text-red-600" />
          ) : (
            <BadgeCheck className="h-5 w-5 text-[var(--brand)]" />
          )}
          รายละเอียดการจอง
        </h1>

        <div className="space-y-1 text-sm text-zinc-800">
          <p>ชื่อ: {booking.fullName}</p>
          <p>รหัสจอง: {booking.bookingCode}</p>
          <p>สิทธิ์เข้าร่วม: {booking.seats} ที่</p>
        </div>

        {booking.status === "waiting_payment_review" ? (
          <div
            className="mt-4 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 shadow-sm"
            role="status"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900/80">สถานะ</p>
            <p className="mt-1.5 text-lg font-bold leading-snug text-amber-950 sm:text-xl">
              {bookingStatusLabel(booking.status)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-800">
            สถานะ:{" "}
            <span className="font-semibold text-zinc-950">{bookingStatusLabel(booking.status)}</span>
          </p>
        )}

        {!isCancelled ? (
          <PaymentQrCard
            bookingCode={booking.bookingCode ?? code}
            initialAmount={booking.paymentAmount}
            initialRef={booking.paymentRef}
            initialImageUrl={booking.paymentQrImageUrl}
            initialExpiresAt={booking.paymentExpiresAt}
            bankName={settings.paymentBankName}
            accountName={settings.paymentAccountName}
            accountNo={settings.paymentAccountNo}
          />
        ) : null}

        {!isCancelled ? (
          <PaymentSlipForm
            bookingCode={booking.bookingCode ?? code}
            initialSlipUrl={booking.slipUrl}
            initialStatus={booking.status}
          />
        ) : null}
      </div>

      </div>
    </main>
  );
}
