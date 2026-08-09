import crypto from "crypto";
import { get, run, transaction } from "./db";

// Matches the credit cost table already specified in
// docs/BACKEND_ARCHITECTURE.md and shown throughout the frontend —
// kept here as the single real source of truth the API enforces,
// exactly the "never hardcode this twice" principle from those docs.
export const CREDIT_COSTS: Record<string, number> = {
  "photo.simple": 40,
  "photo.complex": 80,
  "ad_creative.single": 120,
  "ad_creative.bundle": 300,
  "photoshoot.set": 350,
  "animated_ad.15s": 500,
};

export const SIGNUP_BONUS_CREDITS = 500;

/** Real balance, computed from the real ledger — never a mutable counter. */
export function getCreditBalance(userId: string): number {
  const row = get<{ total: number | null }>(
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

/**
 * Atomically checks and deducts credits in one real SQL transaction, so
 * two simultaneous requests can never both succeed against a balance
 * that only covers one of them — a real race condition a naive
 * "check then write" implementation would be vulnerable to.
 */
export function chargeCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): void {
  transaction(() => {
    const balance = getCreditBalance(userId);
    if (balance < amount) {
      throw new InsufficientCreditsError(amount, balance);
    }
    run(
      "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, -amount, reason, refId ?? null]
    );
  });
}

export function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string
): void {
  run(
    "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, amount, reason, refId ?? null]
  );
}
