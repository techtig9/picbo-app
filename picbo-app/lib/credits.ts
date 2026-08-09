export async function getCreditBalance(userId: string): Promise<number> {
  const row = await get<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM CreditTransaction WHERE userId = ?",
    [userId]
  );
  return row?.total ?? 0;
}

export async function chargeCredits(
  userId: string, amount: number, reason: string, refId?: string
): Promise<void> {
  await transaction(async () => {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
    await run(
      "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, -amount, reason, refId ?? null]
    );
  });
}

export async function grantCredits(
  userId: string, amount: number, reason: string, refId?: string
): Promise<void> {
  await run(
    "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, amount, reason, refId ?? null]
  );
}
