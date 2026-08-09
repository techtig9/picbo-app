import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { hashToken, type User } from "@/lib/auth";
import { sendEmail, passwordResetEmailHtml } from "@/lib/email";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (isRateLimited(`forgot:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  // Same response either way — don't reveal whether the email has an
  // account, matching the anti-enumeration principle already used in
  // app/api/auth/login/route.ts.
  const respond = () => NextResponse.json({ ok: true });

  const user = get<User>("SELECT * FROM User WHERE email = ?", [parsed.data.email]);
  if (!user) return respond();

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  run(
    "INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt) VALUES (?, ?, ?, ?)",
    [crypto.randomUUID(), user.id, hashToken(rawToken), expiresAt.toISOString()]
  );

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/forgot-password.html?token=${rawToken}`;
  await sendEmail(user.email, "Reset your Picbo.ai password", passwordResetEmailHtml(user.name, resetUrl));

  return respond();
}
