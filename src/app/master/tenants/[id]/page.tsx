import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { CreateProjectForm } from "@/components/admin-forms";
import {
  DeleteProjectButton,
  DeleteTenantButton,
  RevokeAccessButton,
} from "@/components/danger-actions";

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
  if (!tenant) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false });
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("tenant_id", id);

  return (
    <AppShell profile={profile} title={tenant.name}>
      <div className="mb-4 text-sm">
        <a href="/master" className="text-brand hover:underline">
          ← All clients
        </a>
      </div>
      <div className="space-y-6">
        <Card title="New project">
          <CreateProjectForm tenantId={tenant.id} />
        </Card>
        <Card title="Projects">
          {!projects?.length ? (
            <p className="text-sm text-slate-500">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center py-3">
                  <a className="font-medium text-brand hover:underline" href={`/master/projects/${p.id}`}>
                    {p.name}
                  </a>
                  <span className="ml-auto">
                    <StatusBadge status={p.status} />
                  </span>
                  {profile?.role === "platform_admin" && (
                    <span className="ml-3">
                      <DeleteProjectButton projectId={p.id} projectName={p.name} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="People on this client">
          {!members?.length ? (
            <p className="text-sm text-slate-500">Invite a client user from the master console, then they sign up with that email.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="font-medium">{m.full_name || m.email}</span>
                  <span className="text-slate-500">{m.role.replace("_", " ")}</span>
                  {profile?.role === "platform_admin" && m.email && (
                    <span className="ml-auto">
                      <RevokeAccessButton profileId={m.id} email={m.email} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {profile?.role === "platform_admin" && (
          <Card title="Danger zone">
            <p className="mb-4 text-sm text-slate-600">
              Deleting this client permanently removes every project, intake,
              Intelligence result, RACI row and export belonging to it.
            </p>
            <DeleteTenantButton tenantId={tenant.id} tenantName={tenant.name} />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
