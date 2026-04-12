import { redirect } from "next/navigation";

function sanitizePath(path: string): string {
  if (!path.startsWith("/")) return "/liff/register";
  if (path.startsWith("//")) return "/liff/register";
  return path;
}

type CallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LiffCallbackPage({ searchParams }: CallbackPageProps) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const directLineUserId = get("lineUserId");
  const directDisplayName = get("displayName");
  const code = get("code");
  const state = get("state");
  const liffState = get("liff.state");

  let decodedStatePath = "/liff/register";
  if (liffState) {
    try {
      decodedStatePath = decodeURIComponent(liffState);
    } catch {
      decodedStatePath = "/liff/register";
    }
  }

  const targetPath = sanitizePath(decodedStatePath);
  const target = new URL(targetPath, "http://localhost");
  const targetRelative = `${target.pathname}${target.search}`;

  if (directLineUserId) target.searchParams.set("lineUserId", directLineUserId);
  if (directDisplayName) target.searchParams.set("displayName", directDisplayName);

  if (!directLineUserId && code && state) {
    const callbackApi = new URL("/api/liff/login/callback", "http://localhost");
    callbackApi.searchParams.set("code", code);
    callbackApi.searchParams.set("state", state);
    callbackApi.searchParams.set("redirectTo", targetRelative);
    redirect(`${callbackApi.pathname}${callbackApi.search}`);
  }

  redirect(`${target.pathname}${target.search}`);
}
