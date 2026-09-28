"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function loadInvite() {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hash.get("error_description") || hash.get("error");
      const queryError = params.get("error_description") || params.get("error");
      if (hashError || queryError) {
        const detail = decodeURIComponent(
          String(hashError || queryError).replace(/\+/g, " ")
        );
        setError(
          /expired|invalid|already/i.test(detail)
            ? "This invitation link was already used or has expired. Ask the platform admin to send a new invitation, then open that newest email."
            : detail
        );
        setReady(true);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      let userEmail = "";
      let fullName = "";

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(sessionError.message);
          setReady(true);
          return;
        }
        userEmail = data.session?.user.email || "";
        fullName = String(data.session?.user.user_metadata?.full_name || "");
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        const tokenHash = params.get("token_hash");
        const type = params.get("type");
        const code = params.get("code");
        if (tokenHash && type) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "invite",
          });
          if (verifyError) {
            setError(verifyError.message);
            setReady(true);
            return;
          }
          userEmail = data.user?.email || "";
          fullName = String(data.user?.user_metadata?.full_name || "");
        } else if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            setReady(true);
            return;
          }
        }
      }

      if (!userEmail) {
        const { data } = await supabase.auth.getUser();
        userEmail = data.user?.email || "";
        fullName = String(data.user?.user_metadata?.full_name || "");
      }

      if (!userEmail) {
        setError(
          "This invitation link did not sign you in. Open the Accept invitation button in the newest email, and allow the page to finish loading. If it still fails, ask the platform admin to send a new invitation."
        );
        setReady(true);
        return;
      }
      setEmail(userEmail);
      setName(fullName);
      setReady(true);
    }
    loadInvite();
  }, []);

  async function accept(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: name.trim() },
      });
      if (updateError) throw updateError;
      const { error: profileError } = await supabase.rpc("ensure_profile");
      if (
        profileError &&
        !/could not find the function|PGRST202/i.test(profileError.message)
      ) {
        throw profileError;
      }
      window.location.assign("/dashboard");
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept this invitation."
      );
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
          Zinnov Dashboard
        </div>
        <h1 className="mt-2 text-2xl font-bold text-navy">Accept your invitation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your password to access the client dashboard.
        </p>
        {!ready ? (
          <p className="mt-6 text-sm text-slate-500">Checking invitation…</p>
        ) : (
          <form onSubmit={accept} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Email</span>
              <input
                value={email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Full name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Password</span>
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Confirm password</span>
              <input
                type="password"
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={saving || !email}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Creating access…" : "Create account and open dashboard"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
