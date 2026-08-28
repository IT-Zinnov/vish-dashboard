import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { IntakeForm } from "@/components/intake-form";
import { RaciEditor } from "@/components/team-actions";
import { canAssignWork, canEditIntake, type IntakePayload } from "@/lib/types";

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  if (profile?.role !== "platform_admin" && profile?.tenant_id !== project.tenant_id) notFound();

  const { data: intake } = await supabase.from("intakes").select("payload").eq("project_id", id).maybeSingle();
  const { data: raci } = await supabase
    .from("raci_rows")
    .select("*")
    .eq("project_id", id)
    .order("sort_order");

  const showOutputs = ["published", "execution"].includes(project.status) || canAssignWork(profile?.role);

  return (
    <AppShell profile={profile} title={project.name}>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <a href="/portal" className="text-brand hover:underline">
          ← Projects
        </a>
        <StatusBadge status={project.status} />
      </div>
      <div className="space-y-6">
        <Card title="Intake form">
          <IntakeForm
            projectId={project.id}
            initial={(intake?.payload || {}) as IntakePayload}
            locked={!canEditIntake(profile?.role, project.status)}
            canSubmit={canEditIntake(profile?.role, project.status)}
          />
        </Card>
        {showOutputs ? (
          <Card title="RACI (assigned by the delivery team)">
            <RaciEditor projectId={project.id} rows={raci || []} canEdit={false} />
          </Card>
        ) : (
          <Card title="Next steps">
            <p className="text-sm text-slate-600">
              After you submit, the delivery team assigns owners and publishes the plan. You will see RACI
              and execution details here once it is published.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
