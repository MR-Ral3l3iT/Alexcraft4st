import { getServerAppBaseUrl } from "./app-base-url";

const BRAND = "#ff6a1a";
const TEXT_MUTED = "#666666";

export function buildRewardDrawResultFlexMessage(input: {
  milestoneLevel: number;
  won: boolean;
  rewardName?: string | null;
  rewardImageUrl?: string | null;
  loseReason?: string | null;
}) {
  const base = getServerAppBaseUrl().replace(/\/$/, "");
  const title = input.won ? "🎉 แตกแล้ว!!" : "😢 ยังไม่แตกนะ";

  const loseCopy =
    input.loseReason === "NO_STOCK" || input.loseReason === "OUT_OF_STOCK"
      ? "อีกนิดเดียว! โชคเกือบมาแล้ว 🔥"
      : input.loseReason === "PROBABILITY_MISS"
        ? "ของหมดไวไปหน่อย 😭 รอรอบหน้าอีกทีนะ"
        : input.loseReason === "MILESTONE_QUOTA_FULL"
          ? "ของรางวัลรอบนี้โดนกวาดไปหมดแล้ว 😆"
        : input.loseReason === "MILESTONE_NOT_REACHED"
          ? "ยังไม่ถึงเลเวลเปิดกล่องนะ 🚀"
          : "ยังไม่ใช่รอบนี้ ลุยใหม่!";

  const bodyLines = input.won
    ? [`คุณได้รับรางวัล: ${input.rewardName ?? "-"}`]
    : [loseCopy];

  const heroImageUrl =
    input.won && input.rewardImageUrl && input.rewardImageUrl.startsWith("/") ? `${base}${input.rewardImageUrl}` : "";

  return {
    type: "flex" as const,
    altText: input.won ? `คุณได้รับรางวัล: ${input.rewardName ?? ""}` : "ผลการเปิดกล่องรางวัล",
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      ...(heroImageUrl
        ? {
            hero: {
              type: "image" as const,
              url: heroImageUrl,
              size: "full" as const,
              aspectRatio: "20:13" as const,
              aspectMode: "cover" as const
            }
          }
        : {}),
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "sm" as const,
        paddingAll: "16px" as const,
        contents: [
          {
            type: "text" as const,
            text: title,
            weight: "bold" as const,
            size: "xl" as const,
            align: "center" as const,
            wrap: true
          },
          ...bodyLines.map((line) => ({
            type: "text" as const,
            text: line,
            size: "sm" as const,
            color: TEXT_MUTED,
            align: "center" as const,
            wrap: true
          })),
          { type: "separator" as const },
          {
            type: "text" as const,
            text: `Milestone: ${input.milestoneLevel} · 🍺 เปิดกล่องจากจำนวนแก้ว`,
            size: "xs" as const,
            color: BRAND,
            align: "center" as const,
            wrap: true
          }
        ]
      }
    }
  };
}
