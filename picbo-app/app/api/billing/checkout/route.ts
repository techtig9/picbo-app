import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { PRICE_IDS } from "@/lib/paddle";

const CheckoutSchema = z.object({
  tier: z.enum(["starter", "pro", "business", "agency"]),
  interval: z.enum(["month", "year"]),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tier or interval" }, { status: 400 });
  }
  const { tier, interval } = parsed.data;

  const priceId = PRICE_IDS[tier]?.[interval];
  if (!priceId) {
    return NextResponse.json({ error: "That plan isn't available yet" }, { status: 400 });
  }

  return NextResponse.json({
    priceId,
    customData: { userId: user.id, tier },
    customerEmail: user.email,
  });
}
