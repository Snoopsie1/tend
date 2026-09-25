import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Copied from Gymie (src/lib/supabase/server.ts).

// Server client bound to the request's auth cookies, for server actions,
// route handlers and server components. RLS applies as the signed-in user.
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A server component cannot write cookies. The proxy refreshes the
          // session, so this is safe to swallow.
        }
      },
    },
  });
}

// Service-role client, which bypasses RLS. Server only. It runs the rate
// limiter and creates new users from the login form. Returns null when
// SUPABASE_SECRET_KEY is not set, so callers can degrade instead of crash.
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
