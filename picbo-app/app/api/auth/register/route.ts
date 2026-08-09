import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { hashPassword, createSession, type User } from "@/lib/auth";
import { grantCredits, SIGNUP_BONUS_CREDITS } from "@/lib/credits";

const RegisterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const existing = await get<User>("SELECT id FROM User WHERE email = ?", [email]);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();
  await run(
    "INSERT INTO User (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, 'user')",
    [userId, name, email, passwordHash]
  );

  await grantCredits(userId, SIGNUP_BONUS_CREDITS, "signup_bonus");
  await createSession(userId);

  return NextResponse.json(
    {
      user: { id: userId, name, email, role: "user" },
      creditsGranted: SIGNUP_BONUS_CREDITS,
    },
    { status: 201 }
  );
}
