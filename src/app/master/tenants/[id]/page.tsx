import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { CreateProjectForm } from "@/components/admin-forms";

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
                <li key={m.id}>
                  <span className="font-medium">{m.full_name || m.email}</span>
                  <span className="ml-2 text-slate-500">{m.role.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
