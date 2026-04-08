import { ADMIN_SESSION_COOKIE } from "@/lib/security/constants";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPublicAdminApi = pathname === "/api/admin/login";

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (isAdminLogin || isPublicAdminApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
