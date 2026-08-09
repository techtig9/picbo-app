import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const jobs = all(
    "SELECT * FROM Job WHERE userId = ? ORDER BY createdAt DESC LIMIT 100",
    [user.id]
  );
  return NextResponse.json({ jobs });
}
