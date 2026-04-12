import { PAYMENT_CONFIG } from "@/config/payment";

type BuildPaymentInput = {
  bookingCode: string;
  lineUserId: string;
  paymentAmount?: number;
  accountNo?: string | null;
};

export type PaymentRequest = {
  paymentAmount: number;
  paymentRef: string;
  paymentQrPayload: string;
  paymentQrImageUrl: string;
  paymentRequestedAt: Date;
  paymentExpiresAt: Date;
};

function generatePaymentRef(bookingCode: string): string {
  const timestamp = Date.now().toString().slice(-6);
  return `PAY-${bookingCode}-${timestamp}`;
}

/** Static QR image path served from /public */
const STATIC_QR_IMAGE = "/images/promptpay/qr-code-promptpay.png";

export function buildPaymentRequest(input: BuildPaymentInput): PaymentRequest {
  const paymentAmount = input.paymentAmount ?? PAYMENT_CONFIG.perPersonThb;
  const paymentRef = generatePaymentRef(input.bookingCode);
  const paymentRequestedAt = new Date();
  const paymentExpiresAt = new Date(paymentRequestedAt.getTime() + PAYMENT_CONFIG.qrExpiryMinutes * 60 * 1000);

  return {
    paymentAmount,
    paymentRef,
    paymentQrPayload: "",
    paymentQrImageUrl: STATIC_QR_IMAGE,
    paymentRequestedAt,
    paymentExpiresAt
  };
}
