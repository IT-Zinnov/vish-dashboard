import { requireUser } from "@/lib/auth";
import { ProjectSwitcher, type SwitcherProject } from "@/components/project-switcher";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; view?: string }>;
}) {
  const { project, view } = await searchParams;
  const { profile, profileError, supabase } = await requireUser();
  const staff =
    profile?.role === "platform_admin" || profile?.role === "team";
  const workspaceHref = staff ? "/master" : "/portal";

  // Row level security already limits clients to their own tenant, so the same
  // query gives staff the full list and clients just their projects.
  const { data: switcherRows } = await supabase
    .from("projects")
    .select("id, name, is_demo, tenants(name)")
    .order("is_demo", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  const switcherProjects: SwitcherProject[] = (switcherRows || []).map((row) => {
    const tenantName = (row.tenants as { name?: string } | null)?.name;
    const base = tenantName ? `${tenantName} — ${row.name}` : row.name;
    return {
      id: row.id,
      label: row.is_demo ? `${base} (Demo)` : base,
      isDemo: Boolean(row.is_demo),
    };
  });

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
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <ProjectSwitcher
            projects={switcherProjects}
            // Mirrors the prototype route's default pick: newest real project
            // first, demo only when there is nothing real.
            activeId={project || switcherProjects[0]?.id}
            view={view}
          />
          <a
            href={workspaceHref}
            className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold hover:bg-brand2"
          >
            {staff ? "Manage clients & projects" : "My projects & intake"}
          </a>
        </div>
      </header>
      <iframe
        title="Corporate Services CoE Hub"
        src={`/dashboard/prototype?${new URLSearchParams({
          ...(project ? { project } : {}),
          ...(view ? { view } : {}),
        }).toString()}`}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </main>
  );
}
