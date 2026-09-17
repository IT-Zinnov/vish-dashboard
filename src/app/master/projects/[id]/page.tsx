import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { IntakeForm } from "@/components/intake-form";
import { RaciEditor, TeamActions } from "@/components/team-actions";
import type { IntakePayload } from "@/lib/types";

export default async function MasterProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  const { data: intake } = await supabase.from("intakes").select("payload").eq("project_id", id).maybeSingle();
  const { data: raci } = await supabase
    .from("raci_rows")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");
  const { data: tenant } = await supabase.from("tenants").select("name").eq("id", project.tenant_id).maybeSingle();

  return (
    <AppShell profile={profile} title={project.name}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <a href={`/master/tenants/${project.tenant_id}`} className="text-brand hover:underline">
          ← {tenant?.name || "Client"}
        </a>
        <StatusBadge status={project.status} />
        <a
          href={`/dashboard?project=${project.id}`}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy2"
        >
          Open project dashboard
        </a>
        <TeamActions
          projectId={project.id}
          status={project.status}
          canPublish={profile?.role === "platform_admin"}
        />
      </div>
      <div className="space-y-6">
        <Card title="Client intake">
          <IntakeForm
            projectId={project.id}
            initial={(intake?.payload || {}) as IntakePayload}
            locked={project.status !== "draft"}
            canSubmit={project.status === "draft"}
          />
        </Card>
        <Card title="Task assignment (RACI) — team only">
          <p className="mb-4 text-sm text-slate-500">
            After submission, assign owners and due dates here. The platform
            admin publishes the finished RACI to the client.
          </p>
          <RaciEditor projectId={project.id} rows={raci || []} canEdit />
        </Card>
      </div>
    </AppShell>
  );
}
