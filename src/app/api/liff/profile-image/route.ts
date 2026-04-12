import { NextRequest, NextResponse } from "next/server";

function isAllowedProfileHost(hostname: string): boolean {
  return hostname === "profile.line-scdn.net" || hostname.endsWith(".line-scdn.net");
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ message: "Missing image url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ message: "Invalid image url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedProfileHost(parsed.hostname)) {
    return NextResponse.json({ message: "Image host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    cache: "no-store"
  });
  if (!upstream.ok) {
    return NextResponse.json({ message: "Failed to fetch profile image" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await upstream.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300"
    }
  });
}
