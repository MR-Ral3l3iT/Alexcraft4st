import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function sanitizePath(path: string): string {
  if (!path.startsWith("/")) return "/liff/register";
  if (path.startsWith("//")) return "/liff/register";
  return path;
}

export async function GET(request: NextRequest) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;

  if (!appBaseUrl || !channelId) {
    return NextResponse.json(
      { message: "Missing APP_BASE_URL or LINE_LOGIN_CHANNEL_ID" },
      { status: 400 }
    );
  }

  const redirectTo = sanitizePath(request.nextUrl.searchParams.get("redirectTo") || "/liff/register");
  const state = randomUUID();
  const nonce = randomUUID();
  const isHttpsRequest = request.nextUrl.protocol === "https:";
  const callbackUrl = `${appBaseUrl}/liff/callback`;
  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", channelId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", "openid profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("liff.state", encodeURIComponent(redirectTo));

  const response = NextResponse.json({ loginUrl: authorizeUrl.toString() });
  response.cookies.set("line_login_state", state, {
    httpOnly: true,
    secure: isHttpsRequest,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  response.cookies.set("line_login_nonce", nonce, {
    httpOnly: true,
    secure: isHttpsRequest,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
