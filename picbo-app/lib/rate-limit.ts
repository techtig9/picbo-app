// In-memory sliding-window limiter. Fine for a single warm server
// process; on serverless (Vercel), each function instance has its own
// memory, so this only limits within one instance, not globally across
// all of them. See the upgrade note at the bottom for real cross-instance
// limiting once you have production traffic worth protecting harder.

const attempts = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const withinWindow = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);

  if (withinWindow.length >= maxAttempts) {
    attempts.set(key, withinWindow);
    return true;
  }
  withinWindow.push(now);
  attempts.set(key, withinWindow);

  if (attempts.size > 5000) {
    for (const [k, times] of attempts) {
      if (times.every((t) => now - t > windowMs)) attempts.delete(k);
    }
  }
  return false;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

/*
 * UPGRADE PATH for real cross-instance limiting:
 *   npm install @upstash/ratelimit @upstash/redis
 *   Free Redis DB at upstash.com — Vercel has a native integration under
 *   Storage -> Upstash. Swap isRateLimited()'s body for an Upstash
 *   Ratelimit.slidingWindow instance; see github.com/upstash/ratelimit
 *   for current API.
 */
