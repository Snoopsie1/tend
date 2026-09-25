"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { requestCode, verifyCode, type CodeState, type LoginState } from "./actions";

const idleLogin: LoginState = { status: "idle" };
const idleCode: CodeState = { status: "idle" };

// Supabase's Email OTP Length is a dashboard setting (6 to 10). Keep this in
// line with parseCode in src/lib/entry-input.ts.
const CODE_MIN = 6;
const CODE_MAX = 10;

const field =
  "h-14 w-full min-w-0 border-2 border-ink-blue bg-paper px-4 text-base text-ink-blue placeholder:text-ink-blue/50 focus:border-ink-pink focus:outline-none";
const primary =
  "min-h-11 w-full border-2 border-ink-blue bg-ink-blue px-4 font-mono text-sm uppercase tracking-wide text-paper shadow-[3px_3px_0_var(--color-ink-pink)] disabled:opacity-50";
const quiet = "min-h-11 px-2 font-mono text-xs uppercase tracking-wide underline underline-offset-4 disabled:opacity-50";

export default function LoginPage() {
  // A new key throws both form states away, for "use a different email".
  const [attempt, setAttempt] = useState(0);
  return (
    <main className="flex min-h-dvh justify-center bg-paper px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] text-ink-blue">
      <div className="flex w-full max-w-sm flex-col justify-center gap-8">
        <header>
          <h1 className="text-5xl font-bold tracking-tight">Tend</h1>
          <p className="mt-1">A daily journal that grows a garden.</p>
        </header>
        <LoginFlow key={attempt} onRestart={() => setAttempt((n) => n + 1)} />
        <Link href="/" className={`${quiet} self-center`}>
          Back to the demo garden
        </Link>
      </div>
    </main>
  );
}

function LoginFlow({ onRestart }: { onRestart: () => void }) {
  const [state, formAction, pending] = useActionState(requestCode, idleLogin);
  // Once a code is out this form is gone, so the address cannot change under
  // the code step.
  if (state.status === "sent" && state.email) return <CodeStep email={state.email} onRestart={onRestart} />;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="font-mono text-xs uppercase tracking-wide">
        Log in with email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="you@example.com"
        className={field}
      />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Sending" : "Send me a code"}
      </button>
      {state.status === "error" && <p className="text-sm text-ink-pink">{state.message}</p>}
      <Suspense fallback={null}>
        <ExpiredLinkNotice />
      </Suspense>
      <p className="text-xs">No password. New or returning, you get a one-time code by email.</p>
    </form>
  );
}

function CodeStep({ email, onRestart }: { email: string; onRestart: () => void }) {
  const [state, formAction, pending] = useActionState(verifyCode, idleCode);
  // The resend keeps its own state, so a failed resend never hides a code
  // you are halfway through typing.
  const [resent, resendAction, resending] = useActionState(requestCode, idleLogin);
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <p className="break-words">
        We sent a code to <strong>{email}</strong>.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code" className="font-mono text-xs uppercase tracking-wide">
          Code from the email
        </label>
        <input
          id="code"
          name="code"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          required
          autoFocus
          value={code}
          // No maxLength, it cuts a pasted "123 456" before onChange sees it.
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_MAX))}
          className={`${field} text-center font-mono text-2xl tracking-[0.4em]`}
        />
        <button type="submit" disabled={pending || code.length < CODE_MIN} className={primary}>
          {pending ? "Checking" : "Log in"}
        </button>
        {state.status === "error" && <p className="text-sm text-ink-pink">{state.message}</p>}
      </form>
      <div className="flex flex-wrap justify-center gap-x-4">
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <button type="submit" disabled={resending} className={quiet}>
            {resending ? "Sending" : "Send a new code"}
          </button>
        </form>
        <button type="button" onClick={onRestart} className={quiet}>
          Use a different email
        </button>
      </div>
      {resent.status === "error" && <p className="text-sm text-ink-pink">{resent.message}</p>}
    </div>
  );
}

// Shown when /auth/confirm sent you back, after an expired or used link.
function ExpiredLinkNotice() {
  const params = useSearchParams();
  if (params.get("error") !== "link") return null;
  return <p className="text-sm text-ink-pink">That link did not work. It may have expired, so ask for a new code.</p>;
}
