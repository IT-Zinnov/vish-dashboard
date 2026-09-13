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
  const redirectWithSession = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  if (!user && !isPublic) {
    return redirectWithSession("/login");
  }

  if (user && path === "/login") {
    return redirectWithSession("/dashboard");
  }

  if (user && path.startsWith("/master")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (
        profile &&
        profile.role !== "platform_admin" &&
        profile.role !== "team"
      ) {
        return redirectWithSession("/portal");
      }
    } catch {
      // Network to PostgREST may fail behind a corporate proxy; allow through.
    }
  }

  return supabaseResponse;
}
