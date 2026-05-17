import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, AUTH_COOKIE } from "@/lib/jwt";

// --- Configuration ---
// Static defaults + env-configured origins (comma-separated in ALLOWED_ORIGINS)
const ENV_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...ENV_ORIGINS,
]);

// Allow same-origin requests dynamically (origin host == request host).
// This makes remote/LAN access work without manually whitelisting every IP.
function isOriginAllowed(origin: string, request: NextRequest): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("host") ?? "";
    // Same host -> same-origin, always allowed
    if (originUrl.host === requestHost) return true;
  } catch {
    /* invalid origin URL */
  }
  return false;
}

const CSRF_COOKIE = "ga_csrf_token";
const CSRF_HEADER = "x-csrf-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const { method, headers, nextUrl } = request;
  const origin = headers.get("origin") ?? "";
  const pathname = nextUrl.pathname;
  const isApi = pathname.startsWith("/api");

  // --- CORS preflight ---
  if (method === "OPTIONS" && isApi) {
    const res = new NextResponse(null, { status: 204 });
    if (isOriginAllowed(origin, request)) {
      res.headers.set("Access-Control-Allow-Origin", origin || "*");
      res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-csrf-token");
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  // --- Authentication check ---
  if (!isPublicPath(pathname)) {
    const sessionToken = request.cookies.get(AUTH_COOKIE)?.value;
    let authenticated = false;

    if (sessionToken) {
      const payload = await verifyJWT(sessionToken);
      authenticated = payload !== null;
    }

    if (!authenticated) {
      // API requests get 401, page requests get redirected to login
      if (isApi) {
        return NextResponse.json(
          { error: "未认证，请先登录", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- CORS origin check for API ---
  if (isApi && origin && !isOriginAllowed(origin, request)) {
    return NextResponse.json({ error: "CORS: origin not allowed" }, { status: 403 });
  }

  // --- CSRF check for mutating API requests (skip auth endpoints) ---
  if (isApi && MUTATING_METHODS.has(method) && !pathname.startsWith("/api/auth")) {
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = headers.get(CSRF_HEADER);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json({ error: "CSRF token mismatch" }, { status: 403 });
    }
  }

  // --- Continue with security headers ---
  const response = NextResponse.next();

  if (isApi && isOriginAllowed(origin, request)) {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  // Set CSRF cookie if not present
  if (!request.cookies.get(CSRF_COOKIE)) {
    const token = generateToken();
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: process.env.COOKIE_SECURE === "true",
    });
  }

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
