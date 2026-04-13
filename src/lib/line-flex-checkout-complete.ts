import { getServerAppBaseUrl } from "./app-base-url";
import { drinkNicknameForCount } from "./drink-nickname";

const BRAND = "#ff6a1a";
const TEXT_MAIN = "#121212";
const TEXT_MUTED = "#666666";
const BRAND_SOFT = "#fff2e9";
const BRAND_ACCENT = "#ffb380";
const SURFACE_CARD = "#111111";
const TEXT_ON_DARK_MUTED = "#d9d9d9";

const CHECKOUT_HERO_PATH = "/images/mascot-icon/cheackout-alexcraft.png";

type CheckoutCompleteFlexInput = {
  fullName: string;
  bookingCode: string;
  drinkCount: number;
  checkoutAt: Date;
};

function truncateForFlex(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildCheckoutCompleteFlexMessage(input: CheckoutCompleteFlexInput) {
  const base = getServerAppBaseUrl().replace(/\/$/, "");
  const heroUrl = `${base}${CHECKOUT_HERO_PATH}`;
  const name = truncateForFlex(input.fullName, 80);
  const code = truncateForFlex(input.bookingCode, 40);
  const drinkCount = Math.max(0, Math.floor(input.drinkCount || 0));
  const titleName = drinkNicknameForCount(drinkCount);
  const checkoutTime = input.checkoutAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  return {
    type: "flex" as const,
    altText: "เช็คเอาท์สำเร็จแล้ว ขอบคุณที่ร่วมค่ำคืนนี้",
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      hero: {
        type: "image" as const,
        url: heroUrl,
        size: "full" as const,
        aspectMode: "cover" as const,
        aspectRatio: "20:13",
        gravity: "top" as const
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "md" as const,
        contents: [
          {
            type: "text" as const,
            text: "🌙 จบค่ำคืนอย่างสมบูรณ์",
            weight: "bold" as const,
            size: "xl" as const,
            wrap: true
          },
          {
            type: "text" as const,
            text: "ขอบคุณที่มาร่วมเป็นส่วนหนึ่งของ Alex’s Craft Brewing 4th Anniversary แล้วพบกันใหม่ในค่ำคืนถัดไป 🍻",
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
                text: `🍺 จำนวนแก้วทั้งหมด: ${drinkCount}`,
                size: "sm" as const,
                color: TEXT_MAIN,
                wrap: true
              },
              {
                type: "text" as const,
                text: `🏷 ฉายาคืนนี้: ${titleName}`,
                size: "sm" as const,
                weight: "bold" as const,
                color: BRAND,
                wrap: true
              },
              {
                type: "text" as const,
                text: `⏰ เวลาเช็คเอาท์: ${checkoutTime}`,
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
                text: "✨ สถานะค่ำคืนนี้",
                weight: "bold" as const,
                size: "sm" as const,
                color: BRAND
              },
              {
                type: "text" as const,
                text: "ภารกิจของคืนนี้เสร็จสมบูรณ์แล้ว ขอบคุณที่มาสนุกด้วยกัน และหวังว่าเราจะได้ยกแก้วกันอีกครั้งเร็ว ๆ นี้",
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
                text: "FINAL STATUS",
                size: "xs" as const,
                color: BRAND_ACCENT,
                align: "center" as const
              },
              {
                type: "text" as const,
                text: "CHECK-OUT COMPLETE",
                size: "lg" as const,
                weight: "bold" as const,
                color: "#FFFFFF",
                align: "center" as const,
                margin: "sm" as const,
                wrap: true
              },
              {
                type: "text" as const,
                text: "Thanks for being part of the night.",
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
