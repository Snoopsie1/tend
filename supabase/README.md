# Supabase setup for Tend

The project is `tend`, in an EU region. Most of this follows Gymie's `supabase/README.md`. Redo every step if the project is ever recreated.

## 1. Database

In the SQL editor, run `migrations/0001_entries.sql`, then `migrations/0002_rate_limit.sql`. Each file runs once.

## 2. Keys

`tend/.env.local` holds three values. Never commit the secret key.

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

The secret key is in Project Settings, API Keys. Only the server uses it, for the login rate limits and to create new users. Without it, nobody can log in for the first time.

Vercel needs the same three values as environment variables.

## 3. Email sender

The built-in sender only mails members of the Supabase team, 2 an hour, and it locks the email templates. Tend sends through Resend on the verified domain `rasoli.dk`, like Gymie.

Project Settings, Authentication, SMTP Settings:

- Host `smtp.resend.com`, port `465`, username `resend`
- Password: a Resend API key with sending access for `rasoli.dk`
- Sender email `tend@rasoli.dk` (the mailbox does not need to exist), sender name `Tend`

## 4. Email templates

Paste `emails/sign-in.html` into both Authentication, Emails, **Magic Link** and **Confirm signup**. A first sign-in can use the signup template. Subject for both: `Your Tend code`. The file is the source of truth, so edit it and paste again.

## 5. Auth settings

- **Allow new users to sign up: off.** The publishable key is public, so open signups would let anyone register past the rate limits. The login form creates new users itself, with the secret key.
- **Email OTP expiration: 900 seconds.** 15 minutes is plenty for a typed code.
- **Email OTP length: 6.** The app accepts 6 to 10 digits.
- **Rate limit for sending emails: 20 an hour.** The default of 2 makes honest retries fail.
- **URL configuration.** Site URL is the production address. Add `http://localhost:3000/auth/confirm`, `http://localhost:3200/auth/confirm` and the production `/auth/confirm` to the redirect list.
