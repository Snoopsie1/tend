import { getServiceSupabase } from "@/lib/supabase/server";

// Fixed-window rate limiter for the login form. Server only. Copied from
// Gymie (src/lib/rate-limit.ts).
//
// The counts live in Postgres (the consume_rate_limit function, service role
// only), so they survive serverless instances coming and going on Vercel.
// Without SUPABASE_SECRET_KEY, or if the call fails, it falls back to a count
// per server instance. That is weaker, but it never lets everything through.

const memory = new Map<string, { hits: number; windowStart: number }>();
let warnedNoSecret = false;

function consumeInMemory(bucket: string, max: number, windowSeconds: number) {
  const now = Date.now();
  const entry = memory.get(bucket);
  if (!entry || now - entry.windowStart > windowSeconds * 1000) {
    memory.set(bucket, { hits: 1, windowStart: now });
    return max >= 1;
  }
  entry.hits += 1;
  return entry.hits <= max;
}

export async function consumeRateLimit(bucket: string, max: number, windowSeconds: number) {
  const service = getServiceSupabase();
  if (!service) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn("[tend] SUPABASE_SECRET_KEY not set, so rate limits only count per server instance.");
    }
    return consumeInMemory(bucket, max, windowSeconds);
  }

  const { data, error } = await service.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[tend] consume_rate_limit failed:", error.message);
    return consumeInMemory(bucket, max, windowSeconds);
  }
  return data === true;
}
