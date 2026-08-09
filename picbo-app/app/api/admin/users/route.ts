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
  // Real server-side role check — this is the boundary that actually
  // matters; a hidden admin link in a UI is not a security control.
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = all<UserRow>(
    "SELECT id, name, email, role, createdAt FROM User ORDER BY createdAt DESC"
  );

  const withBalances = users.map((u) => ({
    ...u,
    creditsBalance: getCreditBalance(u.id),
  }));

  return NextResponse.json({ users: withBalances });
}
