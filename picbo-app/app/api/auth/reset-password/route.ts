import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { hashToken, hashPassword } from "@/lib/auth";

const Schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const row = await get<{ id: string; userId: string; expiresAt: string; usedAt: string | null }>(
    "SELECT * FROM PasswordResetToken WHERE tokenHash = ?",
    [hashToken(parsed.data.token)]
  );
  if (!row || row.usedAt || new Date(row.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await run("UPDATE User SET passwordHash = ? WHERE id = ?", [passwordHash, row.userId]);
  await run("UPDATE PasswordResetToken SET usedAt = datetime('now') WHERE id = ?", [row.id]);
  // Log out every existing session on this account — a leaked/reused
  // reset link shouldn't leave old sessions valid.
  await run("DELETE FROM Session WHERE userId = ?", [row.userId]);

  return NextResponse.json({ ok: true });
}
