import { messagingApi } from "@line/bot-sdk";
import crypto from "node:crypto";

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing");
  }

  return new messagingApi.MessagingApiClient({
    channelAccessToken
  });
}

export async function pushTextMessage(to: string, text: string) {
  const client = getLineClient();
  await client.pushMessage({
    to,
    messages: [{ type: "text", text }]
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safePushTextMessage(to: string, text: string, maxAttempts = 3) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { ok: false, skipped: true, reason: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pushTextMessage(to, text);
      return { ok: true, skipped: false as const };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(300 * attempt);
      }
    }
  }

  return {
    ok: false,
    skipped: false,
    reason: lastError instanceof Error ? lastError.message : "Unknown LINE API error"
  };
}

export function verifyLineSignature(rawBody: string, signature: string | null) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) {
    return false;
  }

  const hash = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  return hash === signature;
}
