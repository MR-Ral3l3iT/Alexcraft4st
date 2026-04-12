import { LINE_REGISTRATION_CONFIRMED_FLEX } from "@/config/line-registration-flex";
import { getServerAppBaseUrl } from "@/lib/app-base-url";

const BRAND = "#ff6a1a";
const BRAND_SOFT = "#fff2e9";
const BRAND_ACCENT = "#ffb380";
const SURFACE_DARK = "#0d0d0f";
const TEXT_MAIN = "#121212";
const TEXT_MUTED = "#666666";
const TEXT_SUBTLE = "#999999";

export type RegistrationConfirmedFlexInput = {
  fullName: string;
  bookingCode: string;
};

function truncateForFlex(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** HTTPS image URL LINE ดึงได้ — เนื้อหา QR = ลิงก์หน้าจองสาธารณะ */
export function bookingPageQrImageUrl(bookingCode: string): string {
  const base = getServerAppBaseUrl();
  const bookingUrl = `${base}/booking/${encodeURIComponent(bookingCode)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(bookingUrl)}`;
}

/**
 * Flex Message หลังแอดมินอนุมัติสลิป (สถานะ confirmed)
 * ธีมสอดคล้อง globals: แบรนด์ส้ม, พื้นเข้ม,แผงอ่อน #fff2e9
 */
export function buildRegistrationConfirmedFlexMessage(input: RegistrationConfirmedFlexInput) {
  const name = truncateForFlex(input.fullName, 80);
  const code = truncateForFlex(input.bookingCode, 40);
  const c = LINE_REGISTRATION_CONFIRMED_FLEX;
  const qrCodeUrl = bookingPageQrImageUrl(input.bookingCode);

  return {
    type: "flex" as const,
    altText: "การยืนยันการลงทะเบียนของคุณสำเร็จแล้ว 🎉",
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      hero: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: SURFACE_DARK,
        paddingAll: "20px",
        contents: [
          {
            type: "text" as const,
            text: c.eventSeries,
            color: BRAND,
            size: "sm" as const,
            weight: "bold" as const,
            align: "center" as const
          },
          {
            type: "text" as const,
            text: c.heroSubtitleEn,
            color: "#FFFFFF",
            size: "xl" as const,
            weight: "bold" as const,
            align: "center" as const,
            margin: "md" as const
          },
          {
            type: "text" as const,
            text: c.heroTagline,
            color: BRAND_ACCENT,
            size: "xs" as const,
            align: "center" as const,
            margin: "sm" as const
          }
        ]
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "md" as const,
        contents: [
          {
            type: "text" as const,
            text: "🎉 ยืนยันการลงทะเบียนสำเร็จ",
            weight: "bold" as const,
            size: "lg" as const,
            color: TEXT_MAIN,
            wrap: true
          },
          {
            type: "text" as const,
            text: "ขอบคุณที่ร่วมเป็นส่วนหนึ่งของค่ำคืนพิเศษกับเรา แล้วพบกันในงานนะครับ 🍻",
            size: "sm" as const,
            color: TEXT_MUTED,
            wrap: true
          },
          { type: "separator" as const, margin: "md" as const },
          {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: `👤 ชื่อ: ${name}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              },
              {
                type: "text" as const,
                text: `🎟 รหัสจอง: ${code}`,
                size: "sm" as const,
                weight: "bold" as const,
                color: BRAND,
                wrap: true
              },
              {
                type: "text" as const,
                text: `📅 วันที่: ${c.eventDateTh}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              },
              {
                type: "text" as const,
                text: `⏰ เวลาเริ่ม: ${c.eventTimeTh}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              },
              {
                type: "text" as const,
                text: `🍺 ${c.perksTh}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              }
            ]
          },
          { type: "separator" as const, margin: "md" as const },
          {
            type: "text" as const,
            text: "QR สำรองหากเช็คอินผ่านระบบไม่ได้",
            size: "sm" as const,
            weight: "bold" as const,
            margin: "md" as const,
            color: TEXT_MAIN,
            wrap: true
          },
          {
            type: "image" as const,
            url: qrCodeUrl,
            size: "md" as const,
            aspectMode: "fit" as const,
            aspectRatio: "1:1" as const,
            margin: "sm" as const
          },
          {
            type: "text" as const,
            text: "แสดง QR นี้ให้ทีมงานหน้างาน หากไม่สามารถเช็คอินผ่านแอปได้",
            size: "xs" as const,
            color: TEXT_SUBTLE,
            wrap: true,
            align: "center" as const
          },
          { type: "separator" as const, margin: "md" as const },
          {
            type: "box" as const,
            layout: "vertical" as const,
            backgroundColor: BRAND_SOFT,
            cornerRadius: "12px",
            paddingAll: "12px",
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "📌 ขั้นตอนถัดไป",
                weight: "bold" as const,
                size: "sm" as const,
                color: BRAND
              },
              {
                type: "text" as const,
                text: "กดเมนู Rich Menu ด้านล่างเพื่อเช็คอินเข้างานหรือดูรายละเอียดสถานที่",
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true,
                margin: "sm" as const
              }
            ]
          }
        ]
      }
    }
  };
}

export type RegistrationConfirmedFlexMessage = ReturnType<typeof buildRegistrationConfirmedFlexMessage>;
