"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseCode, parseEmail } from "@/lib/entry-input";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

// The 6-digit code login, copied from Gymie (src/app/login/actions.ts).

export type LoginState = {
  status: "idle" | "sent" | "error";
  // Echoed back on "sent", so the code step knows which address to verify.
  email?: string;
  message?: string;
};

export type CodeState = { status: "idle" | "error"; message?: string };

// Generous for a person retrying a slow inbox, useless for a spammer.
const EMAIL_LIMIT = { max: 4, windowSeconds: 15 * 60 };
const IP_LIMIT = { max: 12, windowSeconds: 60 * 60 };
// A few retries for a mistyped code, not enough for brute force. The IP limit
// also stops one host from cycling tries across many addresses.
const CODE_LIMIT = { max: 8, windowSeconds: 15 * 60 };
const CODE_IP_LIMIT = { max: 20, windowSeconds: 60 * 60 };

const SEND_FAILED = "Could not send the code. Try again in a minute.";

async function clientIp() {
  return ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

export async function requestCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = parseEmail(form.get("email"));
  if (!email) return { status: "error", message: "That does not look like an email address." };

  const ip = await clientIp();
  const [emailOk, ipOk] = await Promise.all([
    consumeRateLimit(`code:email:${email}`, EMAIL_LIMIT.max, EMAIL_LIMIT.windowSeconds),
    consumeRateLimit(`code:ip:${ip}`, IP_LIMIT.max, IP_LIMIT.windowSeconds),
  ]);
  if (!emailOk || !ipOk) return { status: "error", message: "Too many tries. Take a break and try again later." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const supabase = await getServerSupabase();
  // The project keeps signups off, and shouldCreateUser stays false, because
  // the publishable key is public and anyone could sign up against Supabase
  // directly. New addresses are created here instead, with the secret key, so
  // this rate-limited form is the only way in.
  const options = { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: false };
  let { error } = await supabase.auth.signInWithOtp({ email, options });

  if (error && isUnknownUser(error)) {
    const service = getServiceSupabase();
    if (!service) {
      console.error("[tend] cannot create a new user: SUPABASE_SECRET_KEY not set");
      return { status: "error", message: SEND_FAILED };
    }
    // The code in the email proves the inbox, so the account starts confirmed.
    const { error: createError } = await service.auth.admin.createUser({ email, email_confirm: true });
    // A second submit may have created it first, which is fine.
    if (createError && !/already/i.test(createError.message)) {
      console.error("[tend] admin.createUser failed:", createError.message);
      return { status: "error", message: SEND_FAILED };
    }
    ({ error } = await supabase.auth.signInWithOtp({ email, options }));
  }

  if (error) {
    console.error("[tend] signInWithOtp failed:", JSON.stringify({ code: error.code, status: error.status, message: error.message }));
    return { status: "error", message: SEND_FAILED };
  }
  return { status: "sent", email };
}

// Supabase's answer for an unknown address when shouldCreateUser is false.
function isUnknownUser(error: { code?: string; message: string }) {
  return error.code === "otp_disabled" || /signups? not allowed/i.test(error.message);
}

// The installed app's way in. On an iPhone the home screen app has its own
// cookies, so a link tapped in Mail signs in Safari instead. Typing the code
// runs the sign-in inside the app.
export async function verifyCode(_prev: CodeState, form: FormData): Promise<CodeState> {
  const email = parseEmail(form.get("email"));
  const code = parseCode(form.get("code"));
  if (!email || !code) return { status: "error", message: "Enter the code from the email." };

  const ip = await clientIp();
  const [emailOk, ipOk] = await Promise.all([
    consumeRateLimit(`otp:email:${email}`, CODE_LIMIT.max, CODE_LIMIT.windowSeconds),
    consumeRateLimit(`otp:ip:${ip}`, CODE_IP_LIMIT.max, CODE_IP_LIMIT.windowSeconds),
  ]);
  if (!emailOk || !ipOk) return { status: "error", message: "Too many tries. Ask for a new code." };

  const supabase = await getServerSupabase();
  // "email" covers a normal sign-in. A first sign-in may go out on the signup
  // template, so try that before giving up.
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" }));
  if (error) return { status: "error", message: "That code did not work. It may have expired." };

  // verifyOtp wrote the session cookies. Drop the logged-out render.
  revalidatePath("/", "layout");
  redirect("/");
}
