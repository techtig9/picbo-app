import { NextResponse } from "next/server";
import { z } from "zod";
import { get } from "@/lib/db";
import { verifyPassword, createSession, type User } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (isRateLimited(`login:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = get<User>("SELECT * FROM User WHERE email = ?", [email]);

  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them lets an attacker enumerate which emails have
  // accounts on this system.
  const invalid = () =>
    NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  if (!user) return invalid();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
