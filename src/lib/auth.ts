import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const cookieName = "dashreply_session";
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}
export async function createSession(email: string) {
  const token = await new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
export async function getSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key()); return typeof payload.email === "string" ? { email: payload.email } : null; } catch { return null; }
}
export async function destroySession() {
  const jar = await cookies();
  jar.set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
