import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId");
  const displayName = request.nextUrl.searchParams.get("displayName");
  const pictureUrl = request.nextUrl.searchParams.get("pictureUrl");

  if (lineUserId && displayName) {
    return NextResponse.json({
      lineUserId,
      displayName,
      pictureUrl: pictureUrl || null
    });
  }

  // Optional local fallback for development only.
  if (process.env.ALLOW_DEMO_LIFF_PROFILE === "true") {
    return NextResponse.json({
      lineUserId: "demo-line-user",
      displayName: "LINE Demo User",
      pictureUrl: null
    });
  }

  return NextResponse.json({ message: "LIFF profile not found. Please login with LINE." }, { status: 401 });
}
