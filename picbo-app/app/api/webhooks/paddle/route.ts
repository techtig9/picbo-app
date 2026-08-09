import { NextResponse } from "next/server";
import crypto from "crypto";
import { EventName } from "@paddle/paddle-node-sdk";
import { getPaddleClient, TIER_CREDITS } from "@/lib/paddle";
import { get, run } from "@/lib/db";
import { grantCredits } from "@/lib/credits";

// NOTE: verify the EventName enum members and payload field names
// (sub.currentBillingPeriod, sub.customerId, etc.) against your installed
// SDK's TypeScript types before shipping — Paddle's schema evolves, same
// caveat lib/ai-provider.ts already gives for Gemini's API shape.

export async function POST(req: Request) {
  const rawBody = await req.text(); // must be the raw, untouched body
  const signature = req.headers.get("paddle-signature") ?? "";

  let event;
  try {
    const paddle = getPaddleClient();
    event = await paddle.webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET!, signature);
  } catch (err) {
    // Any non-2xx here makes Paddle retry on its normal schedule.
    // Returning 200 on a failed verification marks a possibly-forged
    // event "delivered" and it never retries — don't do that.
    console.error("Paddle webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated: {
        const sub = event.data;
        const custom = sub.customData as { userId?: string; tier?: string } | null;
        if (!custom?.userId) break;

        const existing = await get<{ id: string }>(
          "SELECT id FROM Subscription WHERE paddleSubscriptionId = ?",
          [sub.id]
        );
        if (existing) {
          await run(
            `UPDATE Subscription SET status = ?, currentPeriodEnd = ?, cancelAtPeriodEnd = ?, updatedAt = datetime('now') WHERE paddleSubscriptionId = ?`,
            [sub.status, sub.currentBillingPeriod?.endsAt ?? null, sub.scheduledChange ? 1 : 0, sub.id]
          );
        } else {
          await run(
            `INSERT INTO Subscription (id, userId, paddleSubscriptionId, paddleCustomerId, tier, interval, status, currentPeriodEnd, cancelAtPeriodEnd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              custom.userId,
              sub.id,
              sub.customerId,
              custom.tier ?? "unknown",
              sub.billingCycle?.interval ?? "month",
              sub.status,
              sub.currentBillingPeriod?.endsAt ?? null,
              0,
            ]
          );
        }
        break;
      }

      case EventName.SubscriptionCanceled: {
        await run(
          `UPDATE Subscription SET status = 'canceled', updatedAt = datetime('now') WHERE paddleSubscriptionId = ?`,
          [event.data.id]
        );
        break;
      }

      case EventName.TransactionCompleted: {
        const txn = event.data;
        const custom = txn.customData as { userId?: string; tier?: string } | null;
        if (!custom?.userId || !custom?.tier) break;

        // Idempotency: Paddle redelivers webhooks. Reuse the same
        // refId-based dedup pattern lib/credits.ts already uses for
        // generation refunds — never grant the same transaction twice.
        const already = await get<{ id: string }>(
          "SELECT id FROM CreditTransaction WHERE refId = ? AND reason = 'subscription_renewal'",
          [txn.id]
        );
        if (already) break;

        const amount = TIER_CREDITS[custom.tier];
        if (amount) await grantCredits(custom.userId, amount, "subscription_renewal", txn.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Paddle webhook handling failed:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
    }
