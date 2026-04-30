import { getServerAppBaseUrl } from "./app-base-url";
import { DRINK_NICKNAME_FROM_10, DRINK_NICKNAME_FROM_3, DRINK_NICKNAME_FROM_6 } from "./drink-nickname";

const BRAND = "#ff6a1a";
const TEXT_MUTED = "#666666";

export type DrinkMilestoneLevel = 1 | 2 | 3;

const HERO_PATH: Record<DrinkMilestoneLevel, string> = {
  1: "/images/mascot-icon/FirstPour-alexcraft.png",
  2: "/images/mascot-icon/BuzzRider-alexcraft.png",
  3: "/images/mascot-icon/MidnightMaster-alexcraft.png"
};

/** ครั้งแรกที่ถึง 3 / 6 / 10 แก้ว (หลังกดเติม) — ตรงตัวอย่าง Flex ใน docs */
export function drinkMilestoneLevelForCount(drinkCount: number): DrinkMilestoneLevel | null {
  if (drinkCount === 3) return 1;
  if (drinkCount === 6) return 2;
  if (drinkCount === 10) return 3;
  return null;
}

function buildRewardBoxLiffUri(level: DrinkMilestoneLevel): string | null {
  const liffId = process.env.LIFF_ID?.trim();
  if (!liffId) return null;
  const milestone = encodeURIComponent(String(level));
  return `https://liff.line.me/${liffId}/liff/reward-box?milestone=${milestone}`;
}

/**
 * Flex แจ้ง milestone แก้ว (LINE ต้องเข้าถึง hero URL ได้ — ตั้ง APP_BASE_URL เป็น https ในโปรดักชัน)
 */
export function buildDrinkMilestoneFlexMessage(level: DrinkMilestoneLevel, drinkCount: number) {
  const base = getServerAppBaseUrl().replace(/\/$/, "");
  const heroUrl = `${base}${HERO_PATH[level]}`;
  const rewardBoxUri = buildRewardBoxLiffUri(level);

  const copy = {
    1: {
      altText: `เริ่มเข้าฟีลแล้ว! ฉายา ${DRINK_NICKNAME_FROM_3}`,
      title: "🍺 เริ่มเข้าฟีลแล้ว!",
      nickname: `ฉายา: ${DRINK_NICKNAME_FROM_3}`,
      body: "กำลังเริ่มต้นได้ดี คืนนี้อีกยาว 🍻"
    },
    2: {
      altText: `เริ่มตึงแล้วนะ! ฉายา ${DRINK_NICKNAME_FROM_6}`,
      title: "🍻 เริ่มตึงแล้วนะ!",
      nickname: `ฉายา: ${DRINK_NICKNAME_FROM_6}`,
      body: "กำลังไปได้สวย อย่าหยุดตอนนี้ 😆"
    },
    3: {
      altText: `ตัวตึงมาแล้ว! ฉายา ${DRINK_NICKNAME_FROM_10}`,
      title: "👑 ตัวตึงมาแล้ว!",
      nickname: `ฉายา: ${DRINK_NICKNAME_FROM_10}`,
      body: "คืนนี้คุณคือระดับตำนานของงานแล้ว 🍺"
    }
  }[level];

  return {
    type: "flex" as const,
    altText: copy.altText,
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      hero: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "10px",
        contents: [
          {
            type: "image" as const,
            url: heroUrl,
            size: "full" as const,
            aspectMode: "cover" as const,
            /** 1:1 ทำให้บล็อก hero สูงมาก รูปมาสคอตมีพื้นขาวด้านล่าง — ใช้สัดส่วนเตี้ย + ยึดด้านบนเพื่อครอปขาวล่างและดึง body ใกล้ภาพ */
            aspectRatio: "20:13",
            gravity: "top"
          }
        ]
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingTop: "none" as const,
        spacing: "sm" as const,
        contents: [
          {
            type: "text" as const,
            text: copy.title,
            weight: "bold" as const,
            size: "xl" as const,
            align: "center" as const,
            wrap: true
          },
          {
            type: "text" as const,
            text: copy.nickname,
            size: "md" as const,
            weight: "bold" as const,
            color: BRAND,
            align: "center" as const,
            wrap: true
          },
          {
            type: "text" as const,
            text: copy.body,
            size: "sm" as const,
            color: TEXT_MUTED,
            align: "center" as const,
            wrap: true
          },
          { type: "separator" as const },
          {
            type: "text" as const,
            text: "🎁 รางวัลพิเศษ: เปิดกล่องลุ้นรางวัลจากของรางวัลในงาน",
            size: "sm" as const,
            color: TEXT_MUTED,
            align: "center" as const,
            wrap: true
          },
          {
            type: "text" as const,
            text: `🍺 จำนวนแก้ว: ${drinkCount}`,
            size: "sm" as const,
            color: BRAND,
            align: "center" as const,
            weight: "bold" as const
          }
        ]
      },
      ...(rewardBoxUri
        ? {
            footer: {
              type: "box" as const,
              layout: "vertical" as const,
              spacing: "sm" as const,
              contents: [
                {
                  type: "button" as const,
                  style: "primary" as const,
                  height: "sm" as const,
                  action: {
                    type: "uri" as const,
                    label: "เปิดกล่องรางวัล",
                    uri: rewardBoxUri
                  },
                  color: BRAND,
                  flex: 1
                }
              ]
            }
          }
        : {})
    }
  };
}
