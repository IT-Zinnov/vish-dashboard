import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import type { Profile } from "@/lib/types";

export async function getSessionProfile() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createClient();
  const user = await getUserAllowingCookieFallback(supabase);
  if (!user) return { supabase, user: null, profile: null as Profile | null };

  const select = () =>
    supabase
      .from("profiles")
      .select("id, tenant_id, role, full_name, email, access_revoked_at")
      .eq("id", user.id)
      .maybeSingle();

  try {
    const { data: profile, error } = await select();
    if (error) throw error;
    if (profile) {
      return { supabase, user, profile: profile as Profile, profileError: null };
    }

    // Session is valid but the profile row is missing (account predates the
    // signup trigger). Create it, then read it back.
    const { error: rpcError } = await supabase.rpc("ensure_profile");
    if (rpcError) throw rpcError;
    const { data: created, error: rereadError } = await select();
    if (rereadError) throw rereadError;
    return {
      supabase,
      user,
      profile: created as Profile | null,
      profileError: null,
    };
  } catch (error) {
    // Distinguish "this account has no profile row" from "the server could not
    // reach Postgres at all" — behind a TLS-intercepting proxy the second is
    // far more likely, and telling the user to re-run a migration is wrong.
    const message = error instanceof Error ? error.message : String(error);
    return {
      supabase,
      user,
      profile: null as Profile | null,
      profileError: message,
    };
  }
}

export async function requireUser() {
  const session = await getSessionProfile();
  if (!session.user) redirect("/login");
  if (session.profile?.access_revoked_at) {
    await session.supabase.auth.signOut();
    redirect("/login?access=revoked");
  }
  return session;
}

export async function requireStaff() {
  const session = await requireUser();
  if (session.profile?.role !== "platform_admin" && session.profile?.role !== "team") {
    redirect("/portal");
  }
  return session;
}
