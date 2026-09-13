import type { SupabaseClient, User } from "@supabase/supabase-js";

function isNetworkAuthError(error: { name?: string; status?: number; message?: string } | null) {
  if (!error) return false;
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    /fetch failed|failed to fetch|networkerror/i.test(error.message || "")
  );
}

/**
 * Prefer a live Auth check. If the office network blocks Node from reaching
 * Supabase (TLS intercept / proxy), fall back to the JWT already in cookies
 * so a successful browser sign-in is not bounced back to /login.
 */
export async function getUserAllowingCookieFallback(
  supabase: SupabaseClient
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return data.user;
    if (!isNetworkAuthError(error)) return null;
  } catch {
    // continue to cookie fallback
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}
