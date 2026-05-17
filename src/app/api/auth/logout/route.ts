import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS } from "@/lib/jwt";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0, // Expire immediately
  });
  return response;
}
