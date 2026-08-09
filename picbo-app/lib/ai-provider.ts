/**
 * ============================================================
 * THE ONE FILE TO EDIT TO MAKE GENERATION REAL
 * ============================================================
 *
 * Every other file in this app (the /api/generate route, the credit
 * ledger, the job records) is fully real and already working — this is
 * the one function that's currently a mock, because generativelanguage
 * .googleapis.com (Google's Gemini API) is not reachable from the
 * sandbox this was built in.
 *
 * To make this real:
 *   1. Get a Gemini API key: https://aistudio.google.com/apikey
 *   2. Set GEMINI_API_KEY in your environment (.env locally, or your
 *      hosting provider's environment variables when live).
 *   3. Replace the body of `generateImage()` below with a real call —
 *      as of writing, Google's Node SDK is `@google/genai`
 *      (`npm install @google/genai`), and the current image-generation
 *      guide lives at https://ai.google.dev/gemini-api/docs/image-generation.
 *      Exact request/response shapes change over time, so check that
 *      page directly when you implement this rather than trusting any
 *      older example — including this comment.
 *   4. Return a real hosted URL for the generated image (upload the
 *      result to S3/R2/Supabase Storage/etc. and return that URL) instead
 *      of the placeholder URL below.
 *
 * Nothing else in the app needs to change — /api/generate/photo calls
 * this function and doesn't care whether the result came from a real
 * model or the mock.
 */

export interface GenerateImageInput {
  prompt: string;
  style?: string;
  aspectRatio?: string;
}

export interface GenerateImageResult {
  resultUrl: string;
  isMock: boolean;
}

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  if (process.env.GEMINI_API_KEY) {
    // A real key is configured, but the real call isn't implemented yet
    // (see the file header above) — fail loudly instead of silently
    // returning a mock, so this is never mistaken for working.
    throw new Error(
      "GEMINI_API_KEY is set, but the real Gemini call in " +
        "lib/ai-provider.ts hasn't been implemented yet — see the " +
        "instructions at the top of this file."
    );
  }

  // --- MOCK PATH (used whenever no real key is configured) ---
  // Simulates real generation latency so the frontend's loading states
  // are tested honestly, and returns a real, working placeholder image
  // URL — genuinely different for every prompt, seeded from the prompt
  // text so the same prompt reliably returns the same placeholder during
  // testing.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const seed = encodeURIComponent(input.prompt.slice(0, 40) || "picbo");
  return {
    resultUrl: `https://picsum.photos/seed/${seed}/800/800`,
    isMock: true,
  };
}
