import { requireUser } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/types";

export default async function PortalHome() {
  const { supabase, profile } = await requireUser();
  if (profile?.role === "platform_admin" || profile?.role === "team") {
    redirect(homeForRole(profile.role));
  }

  if (!profile?.tenant_id) {
    return (
      <AppShell profile={profile} title="Waiting for access">
        <Card title="No client assigned">
          <p className="text-sm text-slate-600">
            Your login works, but you are not attached to a client yet. Ask the platform admin to invite
            this email, then sign out and sign in again — or create a new signup after the invite exists.
          </p>
        </Card>
      </AppShell>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  return (
    <AppShell profile={profile} title="Your projects">
      <Card title="Projects">
        {!projects?.length ? (
          <p className="text-sm text-slate-500">Your team has not created a project for you yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center py-3">
                <a className="font-medium text-brand hover:underline" href={`/portal/projects/${p.id}`}>
                  {p.name}
                </a>
                <span className="ml-auto">
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
