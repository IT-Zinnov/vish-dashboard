import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionProfile() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, profile: profile as Profile | null };
}

export async function requireUser() {
  const session = await getSessionProfile();
  if (!session.user) redirect("/login");
  return session;
}

export async function requireStaff() {
  const session = await requireUser();
  if (session.profile?.role !== "platform_admin" && session.profile?.role !== "team") {
    redirect("/portal");
  }
  return session;
}
