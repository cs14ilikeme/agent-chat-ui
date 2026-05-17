import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, AUTH_COOKIE } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    return NextResponse.json(
      { authenticated: false, user: null, reason: "token_expired" },
      { status: 200 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      username: payload.sub,
      role: payload.role,
      exp: payload.exp,
    },
  });
}
