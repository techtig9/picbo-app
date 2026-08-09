import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const creditsBalance = await getCreditBalance(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    creditsBalance,
  });
}
