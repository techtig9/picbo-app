import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  chargeCredits,
  grantCredits,
  CREDIT_COSTS,
  InsufficientCreditsError,
} from "@/lib/credits";
import { generateImage } from "@/lib/ai-provider";

const GenerateSchema = z.object({
  prompt: z.string().trim().min(3, "Prompt is too short").max(2000),
  style: z.string().max(100).optional(),
  aspectRatio: z.string().max(20).optional(),
  complexity: z.enum(["simple", "complex"]).default("simple"),
});

interface JobRow {
  id: string;
  userId: string;
  type: string;
  status: string;
  prompt: string;
  style: string | null;
  aspectRatio: string | null;
  creditsCharged: number | null;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

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

  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { prompt, style, aspectRatio, complexity } = parsed.data;

  const costKey = complexity === "complex" ? "photo.complex" : "photo.simple";
  const creditsNeeded = CREDIT_COSTS[costKey];

  const jobId = crypto.randomUUID();
  run(
    `INSERT INTO Job (id, userId, type, status, prompt, style, aspectRatio)
     VALUES (?, ?, 'photo', 'processing', ?, ?, ?)`,
    [jobId, user.id, prompt, style ?? null, aspectRatio ?? null]
  );

  try {
    chargeCredits(user.id, creditsNeeded, "generation_charge", jobId);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      run("UPDATE Job SET status = 'failed', errorMessage = ? WHERE id = ?", [
        "Insufficient credits",
        jobId,
      ]);
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: err.required,
          available: err.available,
        },
        { status: 402 }
      );
    }
    throw err;
  }

  try {
    const result = await generateImage({ prompt, style, aspectRatio });

    run(
      `UPDATE Job SET status = 'completed', resultUrl = ?, creditsCharged = ?,
       completedAt = datetime('now') WHERE id = ?`,
      [result.resultUrl, creditsNeeded, jobId]
    );

    const completedJob = get<JobRow>("SELECT * FROM Job WHERE id = ?", [jobId]);

    return NextResponse.json({
      job: completedJob,
      isMock: result.isMock,
      note: result.isMock
        ? "Generated with the mock AI provider — see lib/ai-provider.ts to connect real Gemini generation."
        : undefined,
    });
  } catch (err) {
    // Generation failed after credits were already charged — refund them.
    // This refund-on-failure pattern (rather than charge-after-success)
    // is a deliberate choice documented in docs/BACKEND_ARCHITECTURE.md §7.
    try {
      grantCredits(user.id, creditsNeeded, "refund", jobId);
    } catch {
      /* best-effort refund */
    }
    run("UPDATE Job SET status = 'failed', errorMessage = ? WHERE id = ?", [
      err instanceof Error ? err.message : "Generation failed",
      jobId,
    ]);
    return NextResponse.json({ error: "Generation failed, credits refunded" }, { status: 502 });
  }
}
