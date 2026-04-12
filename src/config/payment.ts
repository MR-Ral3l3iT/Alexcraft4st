export const PAYMENT_CONFIG = {
  perPersonThb: Number(process.env.PAYMENT_PER_PERSON_THB ?? 799),
  promptPayId: process.env.PROMPTPAY_ID ?? "",
  qrExpiryMinutes: Number(process.env.PAYMENT_QR_EXPIRY_MINUTES ?? 30)
} as const;
