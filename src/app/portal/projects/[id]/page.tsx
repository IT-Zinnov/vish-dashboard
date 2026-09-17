import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { IntakeForm } from "@/components/intake-form";
import { RaciEditor } from "@/components/team-actions";
import { canAssignWork, canEditIntake, type IntakePayload } from "@/lib/types";

const STAGE_COPY: Record<string, string> = {
  draft: "Complete and submit the intake. Intelligence and metrics unlock automatically.",
  submitted: "Submission received. Zinnov Intelligence is being generated.",
  in_review: "Intelligence and metrics are ready. The delivery team is preparing RACI assignments.",
  published: "The plan and RACI are published and visible to your client team.",
  execution: "Delivery is in execution; all published outputs remain available.",
};

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

  const showRaci =
    (Boolean(project.raci_published_at) &&
      ["published", "execution"].includes(project.status)) ||
    canAssignWork(profile?.role);

  return (
    <AppShell profile={profile} title={project.name}>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <a href="/portal" className="text-brand hover:underline">
          ← Projects
        </a>
        <StatusBadge status={project.status} />
        <a
          href={`/dashboard?project=${project.id}`}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy2"
        >
          Open dashboard
        </a>
      </div>
      <div className="space-y-6">
        <Card title={`Current stage: ${project.status.replace("_", " ")}`}>
          <p className="text-sm text-slate-600">
            {STAGE_COPY[project.status] || "Project status is being updated."}
          </p>
        </Card>
        <Card title="Intake form">
          <IntakeForm
            projectId={project.id}
            initial={(intake?.payload || {}) as IntakePayload}
            locked={!canEditIntake(profile?.role, project.status)}
            canSubmit={canEditIntake(profile?.role, project.status)}
          />
        </Card>
        {showRaci ? (
          <Card title="RACI (assigned by the delivery team)">
            <RaciEditor projectId={project.id} rows={raci || []} canEdit={false} />
          </Card>
        ) : (
          <Card title="Next steps">
            <p className="text-sm text-slate-600">
              Zinnov Intelligence and project metrics are available immediately
              after submission. RACI remains locked while the delivery team
              assigns owners; it appears here after the platform admin publishes it.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
