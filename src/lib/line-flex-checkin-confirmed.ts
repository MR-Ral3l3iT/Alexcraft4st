import { LINE_REGISTRATION_CONFIRMED_FLEX } from "@/config/line-registration-flex";

const BRAND = "#ff6a1a";
const BRAND_SOFT = "#fff2e9";
const BRAND_ACCENT = "#ffb380";
const SURFACE_DARK = "#0d0d0f";
const TEXT_MAIN = "#121212";
const TEXT_MUTED = "#666666";
const SURFACE_CARD = "#111111";
const TEXT_ON_DARK_MUTED = "#d9d9d9";

export type CheckinConfirmedFlexInput = {
  fullName: string;
  bookingCode: string;
  checkedInAt: Date;
};

function truncateForFlex(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Flex หลังเช็คอินสำเร็จ (self หรือแอดมิน)
 */
export function buildCheckinConfirmedFlexMessage(input: CheckinConfirmedFlexInput) {
  const name = truncateForFlex(input.fullName, 80);
  const code = truncateForFlex(input.bookingCode, 40);
  const c = LINE_REGISTRATION_CONFIRMED_FLEX;
  const checkinTime = input.checkedInAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  return {
    type: "flex" as const,
    altText: "เช็คอินเข้างานสำเร็จแล้ว",
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      hero: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: SURFACE_DARK,
        paddingTop: "24px",
        paddingBottom: "24px",
        paddingStart: "20px",
        paddingEnd: "20px",
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
            text: "CHECK-IN SUCCESS",
            color: "#FFFFFF",
            size: "xl" as const,
            weight: "bold" as const,
            align: "center" as const,
            margin: "md" as const
          },
          {
            type: "text" as const,
            text: "Welcome to your exclusive night",
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
            text: "🍻 เช็คอินสำเร็จแล้ว",
            weight: "bold" as const,
            size: "lg" as const,
            color: TEXT_MAIN,
            wrap: true
          },
          {
            type: "text" as const,
            text: "ยินดีต้อนรับเข้าสู่ค่ำคืนสุดพิเศษของ Alex’s Craft Brewing ขอให้คุณสนุกกับบรรยากาศ อาหาร และ Free Flow ตลอดค่ำคืนนี้",
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
                text: `👤 ผู้เข้าร่วม: ${name}`,
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
                text: `⏰ เวลาเช็คอิน: ${checkinTime}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              },
              {
                type: "text" as const,
                text: "🍺 สิทธิ์ของคุณ: Free Flow + อาหาร",
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              }
            ]
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
                text: "✨ สิทธิ์ที่ปลดล็อกแล้ว",
                weight: "bold" as const,
                size: "sm" as const,
                color: BRAND
              },
              {
                type: "text" as const,
                text: "คุณสามารถกดเมนู Rich Menu ด้านล่างเพื่อเริ่มสะสมเลเวล เติมเบียร์ และดูสถานะพลังของคุณได้ทันที",
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true,
                margin: "sm" as const
              }
            ]
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            backgroundColor: SURFACE_CARD,
            cornerRadius: "12px",
            paddingAll: "14px",
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "Tonight's Status",
                size: "xs" as const,
                color: BRAND_ACCENT,
                align: "center" as const
              },
              {
                type: "text" as const,
                text: "ACTIVE",
                size: "xl" as const,
                weight: "bold" as const,
                color: "#FFFFFF",
                align: "center" as const,
                margin: "sm" as const
              },
              {
                type: "text" as const,
                text: "Your night has officially begun.",
                size: "xs" as const,
                color: TEXT_ON_DARK_MUTED,
                align: "center" as const,
                margin: "sm" as const,
                wrap: true
              }
            ]
          }
        ]
      }
    }
  };
}
