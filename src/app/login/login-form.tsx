"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function explainAuthError(raw: string) {
  if (/email address .* is invalid|email_address_invalid/i.test(raw)) {
    return "Supabase rejects test addresses like demo@ or example@. Use a real inbox you own.";
  }
  if (/email not confirmed|email_not_confirmed/i.test(raw)) {
    return "This account exists but is not confirmed. In Supabase, turn off Authentication → Sign In / Providers → Email → Confirm email, then run 002_backfill_existing_users.sql.";
  }
  if (/invalid login credentials/i.test(raw)) {
    return "Wrong email or password — or the account was never created. Try Sign up instead.";
  }
  if (/schema cache|does not exist|PGRST205/i.test(raw)) {
    return "Database tables are missing. Run supabase/migrations/001_init.sql in the Supabase SQL Editor.";
  }
  if (/fetch failed|failed to fetch|retryable/i.test(raw)) {
    return "This machine could not reach Supabase (office proxy or SSL intercept). Sign-in must be done at http://localhost:3000 — not by opening the HTML file from Downloads.";
  }
  return raw;
}

/**
 * Auth only creates the auth.users row. The profiles row is what carries the
 * role, so make sure it exists before entering the app. Runs in the browser
 * because this machine's Node process is sometimes blocked from Supabase.
 */
async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { error } = await supabase.rpc("ensure_profile");
  if (!error) return;

  const helperMissing = /could not find the function|PGRST202/i.test(
    error.message
  );
  if (!helperMissing) throw error;

  // ensure_profile() isn't installed, but the 001 signup trigger may already
  // have created the row. Only block sign-in if there is genuinely no profile.
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (data) return;

  throw new Error(
    "Your account has no profile row yet. Run supabase/migrations/003_ensure_profile.sql in the Supabase SQL Editor, then sign in again."
  );
}

export default function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data: authData, error: err } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        if (authData.session) {
          await ensureProfile(supabase, authData.session.user.id);
          window.location.assign("/dashboard");
          return;
        }
        setMessage("Account created. If email confirmation is on in Supabase, check your inbox, then sign in.");
        setMode("signin");
      } else {
        const { data: authData, error: err } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
        if (err) throw err;
        if (!authData.session) {
          throw new Error("Supabase did not create a login session.");
        }
        await ensureProfile(supabase, authData.session.user.id);
        window.location.assign("/dashboard");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong";
      setError(explainAuthError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Full name</span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Email</span>
        <input
          type="email"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Password</span>
        <input
          type="password"
          minLength={6}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-navy2 disabled:opacity-60"
      >
        {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        className="w-full text-sm text-brand"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setMessage(null);
        }}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
