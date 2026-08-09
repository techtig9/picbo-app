import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// ============================================================
// THE ONE FILE TO EDIT ONCE YOUR PADDLE PRODUCTS/PRICES EXIST
// ============================================================
// After creating the 5 products in Paddle Dashboard -> Catalog -> Products
// (Free needs no Paddle price), paste the 8 real Price IDs here.

export const PRICE_IDS: Record<string, { month: string; year: string }> = {
  starter:  { month: "pri_REPLACE_STARTER_MONTHLY",  year: "pri_REPLACE_STARTER_YEARLY" },
  pro:      { month: "pri_REPLACE_PRO_MONTHLY",      year: "pri_REPLACE_PRO_YEARLY" },
  business: { month: "pri_REPLACE_BUSINESS_MONTHLY", year: "pri_REPLACE_BUSINESS_YEARLY" },
  agency:   { month: "pri_REPLACE_AGENCY_MONTHLY",   year: "pri_REPLACE_AGENCY_YEARLY" },
};

// Monthly credit allotment per tier — matches the numbers already shown
// in public/billing.html's plan cards. This is what the webhook grants
// on every successful renewal.
export const TIER_CREDITS: Record<string, number> = {
  starter: 8000,
  pro: 25000,
  business: 70000,
  agency: 200000,
};

const globalForPaddle = globalThis as unknown as { paddleClient?: Paddle };

export function getPaddleClient(): Paddle {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not set.");
  }
  if (!globalForPaddle.paddleClient) {
    globalForPaddle.paddleClient = new Paddle(process.env.PADDLE_API_KEY, {
      environment:
        process.env.PADDLE_ENVIRONMENT === "production"
          ? Environment.production
          : Environment.sandbox,
    });
  }
  return globalForPaddle.paddleClient;
}
