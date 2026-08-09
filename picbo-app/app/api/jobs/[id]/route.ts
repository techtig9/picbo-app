import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

interface JobRow {
  id: string;
  userId: string;
  status: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;

  const job = await get<JobRow>("SELECT * FROM Job WHERE id = ?", [id]);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
