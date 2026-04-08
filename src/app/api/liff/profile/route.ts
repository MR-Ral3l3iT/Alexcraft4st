import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId") || "demo-line-user";
  const displayName = request.nextUrl.searchParams.get("displayName") || "LINE Demo User";

  return NextResponse.json({
    lineUserId,
    displayName
  });
}
