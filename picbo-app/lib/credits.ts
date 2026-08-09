import crypto from "crypto";
import { get, run, transaction } from "./db";

export const CREDIT_COSTS: Record<string, number> = {
  "photo.simple": 40,
  "photo.complex": 80,
  "ad_creative.single": 120,
  "ad_creative.bundle": 300,
  "photoshoot.set": 350,
  "animated_ad.15s": 500,
};

export const SIGNUP_BONUS_CREDITS = 500;

export async function getCreditBalance(userId: string): Promise<number> {
  const row = await get<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM CreditTransaction WHERE userId = ?",
    [userId]
  );
  return row?.total ?? 0;
}

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
  }
}

export async function chargeCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  await transaction(async () => {
    const balance = await getCreditBalance(userId);
    if (balance < amount) {
      throw new InsufficientCreditsError(amount, balance);
    }
    await run(
      "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, -amount, reason, refId ?? null]
    );
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): Promise<void> {
  await run(
    "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, amount, reason, refId ?? null]
  );
}
