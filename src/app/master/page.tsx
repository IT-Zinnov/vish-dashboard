import { requireStaff } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { CreateTenantForm, InviteForm } from "@/components/admin-forms";

export default async function MasterHome() {
  const { supabase, profile } = await requireStaff();
  const { data: tenants } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, tenant_id, submitted_at, created_at, tenants(name)")
    .order("created_at", { ascending: false });
  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, accepted_at, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell profile={profile} title="Master console">
      <div className="space-y-6">
        <Card title="Onboard a client">
          <CreateTenantForm />
        </Card>
        <Card title="Invite users">
          <InviteForm tenants={tenants || []} />
        </Card>
        <Card title="Clients">
          {!tenants?.length ? (
            <p className="text-sm text-slate-500">No clients yet. Onboard the first company above.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <li key={t.id} className="flex items-center py-3">
                  <div>
                    <a className="font-medium text-brand hover:underline" href={`/master/tenants/${t.id}`}>
                      {t.name}
                    </a>
                    <div className="text-xs text-slate-500">{t.slug}</div>
                  </div>
                  <span className="ml-auto text-xs capitalize text-slate-400">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="All projects">
          {!projects?.length ? (
            <p className="text-sm text-slate-500">Create a project from a client page after onboarding.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="pb-2">Project</th>
                  <th className="pb-2">Client</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <a className="font-medium text-brand hover:underline" href={`/master/projects/${p.id}`}>
                        {p.name}
                      </a>
                    </td>
                    <td className="py-2 text-slate-600">
                      {(p.tenants as { name?: string } | null)?.name || "—"}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Recent invites">
          {!invites?.length ? (
            <p className="text-sm text-slate-500">No invites yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <span className="font-medium">{i.email}</span>
                  <span className="text-slate-500">{i.role.replace("_", " ")}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {i.accepted_at ? "accepted" : "pending"} · {(i.tenants as { name?: string } | null)?.name || "internal"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
