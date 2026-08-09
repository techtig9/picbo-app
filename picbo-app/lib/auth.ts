import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { get, run } from "./db";

const SESSION_COOKIE = "picbo_session";
const SESSION_TTL_DAYS = 30;

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(rawToken: string): string {
  // The raw token lives only in the user's browser cookie. We store a
  // SHA-256 hash of it in the database — if the database ever leaked,
  // the leaked hashes could not be turned back into working session
  // cookies, the same principle as password hashing.
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Creates a real session row in the database and sets the session cookie. */
export async function createSession(userId: string): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  run(
    "INSERT INTO Session (id, userId, tokenHash, expiresAt) VALUES (?, ?, ?, ?)",
    [crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString()]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Reads the session cookie and returns the real logged-in user, or null. */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const session = get<{ userId: string; expiresAt: string }>(
    "SELECT userId, expiresAt FROM Session WHERE tokenHash = ?",
    [tokenHash]
  );

  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const user = get<User>("SELECT * FROM User WHERE id = ?", [session.userId]);
  return user ?? null;
}

/** Logs the current session out: deletes it server-side and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    run("DELETE FROM Session WHERE tokenHash = ?", [tokenHash]);
  }
  cookieStore.delete(SESSION_COOKIE);
}
