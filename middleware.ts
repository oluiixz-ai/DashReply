import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("dashreply_session");
  if (request.nextUrl.pathname === "/login" && hasSession) return NextResponse.redirect(new URL("/", request.url));
  if (request.nextUrl.pathname === "/" && !hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login"] };
