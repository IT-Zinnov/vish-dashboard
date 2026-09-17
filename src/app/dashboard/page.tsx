import { requireUser } from "@/lib/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const { profile, profileError } = await requireUser();
  const staff =
    profile?.role === "platform_admin" || profile?.role === "team";
  const workspaceHref = staff ? "/master" : "/portal";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-navy">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/10 bg-navy px-4 text-white">
        <div className="text-xs font-semibold">Zinnov Dashboard</div>
        <div className="h-4 w-px bg-white/15" />
        <div className="truncate text-[11px] text-white/55">
          {profile?.full_name || profile?.email || "Signed in"}
        </div>
        {profile ? (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
            {profile.role.replace("_", " ")}
          </span>
        ) : profileError ? (
          <span
            title={profileError}
            className="rounded bg-red-400/15 px-2 py-0.5 text-[10px] text-red-200"
          >
            Cannot reach the database — role unknown
          </span>
        ) : (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">
            No profile yet — run 003_ensure_profile.sql
          </span>
        )}
        <a
          href={workspaceHref}
          className="ml-auto rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold hover:bg-brand2"
        >
          {staff ? "Manage clients & projects" : "My projects & intake"}
        </a>
      </header>
      <iframe
        title="Corporate Services CoE Hub"
        src={`/dashboard/prototype${project ? `?project=${encodeURIComponent(project)}` : ""}`}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </main>
  );
}
