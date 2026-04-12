import { NextRequest, NextResponse } from "next/server";

type LineTokenResponse = {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type LineProfileResponse = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

function sanitizePath(path: string): string {
  if (!path.startsWith("/")) return "/liff/register";
  if (path.startsWith("//")) return "/liff/register";
  return path;
}

function buildRedirectUrl(request: NextRequest, path: string, appBaseUrl?: string): URL {
  const safePath = sanitizePath(path || "/liff/register");
  const baseUrl = appBaseUrl || request.nextUrl.origin;
  return new URL(safePath, baseUrl);
}

export async function GET(request: NextRequest) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const redirectTo = request.nextUrl.searchParams.get("redirectTo") || "/liff/register";

  function redirectWithError(message: string, status: number) {
    const redirectUrl = buildRedirectUrl(request, redirectTo, appBaseUrl);
    redirectUrl.searchParams.set("loginError", message);
    return NextResponse.redirect(redirectUrl, { status });
  }

  if (!appBaseUrl || !channelId || !channelSecret) {
    return redirectWithError("missing_env", 302);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("line_login_state")?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return redirectWithError("invalid_state", 302);
  }

  const callbackUrl = `${appBaseUrl}/liff/callback`;
  const formData = new URLSearchParams();
  formData.set("grant_type", "authorization_code");
  formData.set("code", code);
  formData.set("redirect_uri", callbackUrl);
  formData.set("client_id", channelId);
  formData.set("client_secret", channelSecret);

  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString()
  });
  if (!tokenResponse.ok) {
    return redirectWithError("token_exchange_failed", 302);
  }

  const tokenJson = (await tokenResponse.json()) as LineTokenResponse;
  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!profileResponse.ok) {
    return redirectWithError("profile_load_failed", 302);
  }
  const profile = (await profileResponse.json()) as LineProfileResponse;

  const redirectUrl = buildRedirectUrl(request, redirectTo, appBaseUrl);
  redirectUrl.searchParams.set("lineUserId", profile.userId);
  redirectUrl.searchParams.set("displayName", profile.displayName);
  if (profile.pictureUrl) redirectUrl.searchParams.set("pictureUrl", profile.pictureUrl);

  const response = NextResponse.redirect(redirectUrl, { status: 302 });
  response.cookies.set("line_login_state", "", { path: "/", maxAge: 0 });
  response.cookies.set("line_login_nonce", "", { path: "/", maxAge: 0 });
  return response;
}
