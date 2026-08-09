import { NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { hashToken } from "@/lib/auth";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login.html?verified=0", req.url));

  const row = get<{ userId: string; expiresAt: string }>(
    "SELECT userId, expiresAt FROM EmailVerificationToken WHERE tokenHash = ?",
    [hashToken(token)]
  );
  if (!row || new Date(row.expiresAt) < new Date()) {
    return NextResponse.redirect(new URL("/login.html?verified=0", req.url));
  }

  run("UPDATE User SET emailVerifiedAt = datetime('now') WHERE id = ?", [row.userId]);
  run("DELETE FROM EmailVerificationToken WHERE userId = ?", [row.userId]);
  return NextResponse.redirect(new URL("/login.html?verified=1", req.url));
}
