import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

// Copied from Gymie (src/app/auth/confirm/route.ts). Turns the link in the
// sign-in email into a session cookie. The typed code is the main path, the
// link is for a normal browser.
//
// ?token_hash=...&type=email is the flow the Tend email template uses. It
// works even when the link opens in another browser than the one that asked.
// ?code=... is Supabase's default redirect, kept for an unedited template. It
// only works in the browser that asked.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await getServerSupabase();

  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const dest = request.nextUrl.clone();
  dest.search = "";
  dest.pathname = ok ? "/" : "/login";
  if (!ok) dest.searchParams.set("error", "link");
  return NextResponse.redirect(dest);
}
