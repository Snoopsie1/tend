import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next 16 proxy, copied from Gymie (src/proxy.ts). It keeps the auth session
// fresh, because only a proxy or an action may write the refreshed cookies.
// Unlike Gymie it never sends a logged-out visitor to /login, because they
// land on the demo garden. A signed-in user never sees /login.

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() checks the token with Supabase and refreshes it. getSession()
  // would trust the cookie unverified.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && request.nextUrl.pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    const redirect = NextResponse.redirect(home);
    // Carry the refreshed cookies onto the redirect, or the new tokens are lost.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  // Everything except static files and Next internals. sw.js and the manifest
  // stay out for the PWA in milestone 4.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
