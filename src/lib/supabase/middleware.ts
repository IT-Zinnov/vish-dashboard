import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const user = await getUserAllowingCookieFallback(supabase);

  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/auth");
  const redirectWithSession = (pathname: string, search?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search || "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  if (!user && !isPublic) {
    return redirectWithSession("/login");
  }

  let profile: { role: string; access_revoked_at: string | null } | null = null;
  if (user) {
    try {
      const result = await supabase
        .from("profiles")
        .select("role, access_revoked_at")
        .eq("id", user.id)
        .maybeSingle();
      profile = result.data;
    } catch {
      // Network to PostgREST may fail behind a corporate proxy.
    }
  }

  if (user && profile?.access_revoked_at) {
    await supabase.auth.signOut();
    return redirectWithSession("/login", "?access=revoked");
  }

  if (user && path === "/login") {
    return redirectWithSession("/dashboard");
  }

  if (
    user &&
    path.startsWith("/master") &&
    profile &&
    profile.role !== "platform_admin" &&
    profile.role !== "team"
  ) {
    return redirectWithSession("/portal");
  }

  return supabaseResponse;
}
