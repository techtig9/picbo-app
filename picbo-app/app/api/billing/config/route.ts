import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || null,
    environment: process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox",
  });
}
