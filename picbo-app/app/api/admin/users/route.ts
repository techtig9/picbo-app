import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await all<UserRow>(
    "SELECT id, name, email, role, createdAt FROM User ORDER BY createdAt DESC"
  );

  const withBalances = await Promise.all(
    users.map(async (u) => ({
      ...u,
      creditsBalance: await getCreditBalance(u.id),
    }))
  );

  return NextResponse.json({ users: withBalances });
}
