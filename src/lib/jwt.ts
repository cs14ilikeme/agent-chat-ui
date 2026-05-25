/**
 * Zero-dependency JWT implementation using Web Crypto API
 * Compatible with Next.js Edge Runtime (middleware)
 */

export interface JWTPayload {
  sub: string; // username
  role: "admin" | "worker" | "viewer";
  iat: number;
  exp: number;
}

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return secret;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    ALGORITHM,
    false,
    ["sign", "verify"]
  );
}

function base64url(data: Uint8Array): string {
  let str = "";
  for (const byte of data) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return base64url(bytes);
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signJWT(payload: Omit<JWTPayload, "iat" | "exp">, expiresInSeconds = 86400): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64urlEncode(header);
  const payloadB64 = base64urlEncode(fullPayload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await getCryptoKey();
    const signatureBytes = base64urlDecode(signatureB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    const payloadBytes = base64urlDecode(payloadB64);
    const payload: JWTPayload = JSON.parse(new TextDecoder().decode(payloadBytes));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = "ga_session";
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  // secure: true requires HTTPS; disable for HTTP remote access
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400, // 24h
};
