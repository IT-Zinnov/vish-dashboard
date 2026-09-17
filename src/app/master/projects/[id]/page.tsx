import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { IntakeForm } from "@/components/intake-form";
import { RaciEditor, TeamActions } from "@/components/team-actions";
import { DeleteProjectButton } from "@/components/danger-actions";
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
  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("id, version, status, output, created_at")
    .eq("project_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const output = (recommendation?.output || {}) as {
    basis?: { headcount?: number; month24Headcount?: number };
    workplace?: { workstations?: number; dayOneAreaSqft?: number };
  };
  const canEditRaci =
    recommendation?.status === "approved" ||
    ["published", "execution"].includes(project.status);

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
          recommendationStatus={recommendation?.status}
        />
        {profile?.role === "platform_admin" && (
          <span className="ml-auto">
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.name}
            />
          </span>
        )}
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
        <Card
          title="Zinnov Intelligence"
          actions={
            recommendation ? (
              <a
                href={`/dashboard?project=${project.id}&view=ai`}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
              >
                Open Intelligence report
              </a>
            ) : undefined
          }
        >
          {recommendation ? (
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="font-semibold capitalize">{recommendation.status}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Version</div>
                <div className="font-semibold">{recommendation.version}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Headcount</div>
                <div className="font-semibold">
                  {output.basis?.headcount ?? "—"} → {output.basis?.month24Headcount ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Recommended footprint</div>
                <div className="font-semibold">
                  {output.workplace?.workstations ?? "—"} desks ·{" "}
                  {output.workplace?.dayOneAreaSqft?.toLocaleString() ?? "—"} sq ft
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Intelligence is generated automatically when the client submits this intake.
            </p>
          )}
        </Card>
        <Card title="Task assignment (RACI) — team only">
          <p className="mb-4 text-sm text-slate-500">
            {canEditRaci
              ? "Assign owners and due dates here. The platform admin publishes the finished RACI to the client."
              : "Approve the generated Zinnov Intelligence recommendation before assigning RACI."}
          </p>
          <RaciEditor projectId={project.id} rows={raci || []} canEdit={canEditRaci} />
        </Card>
      </div>
    </AppShell>
  );
}
