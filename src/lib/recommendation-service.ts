import { generateRecommendation } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntakePayload } from "@/lib/types";

export async function generateAndStoreRecommendation({
  projectId,
  actorId,
  payload,
}: {
  projectId: string;
  actorId: string;
  payload: IntakePayload;
}) {
  const admin = createAdminClient();
  const [{ data: project }, { data: intake }, { data: latest }] =
    await Promise.all([
      admin
        .from("projects")
        .select("id, tenant_id")
        .eq("id", projectId)
        .single(),
      admin
        .from("intakes")
        .select("id")
        .eq("project_id", projectId)
        .single(),
      admin
        .from("recommendations")
        .select("version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!project || !intake) {
    throw new Error("Project intake was not found.");
  }

  const version = (latest?.version || 0) + 1;
  const output = generateRecommendation(payload);
  const { data: recommendation, error } = await admin
    .from("recommendations")
    .insert({
      tenant_id: project.tenant_id,
      project_id: project.id,
      intake_id: intake.id,
      version,
      status: "ready",
      assumptions: {},
      output,
      generated_by: actorId,
    })
    .select("*")
    .single();

  if (error) throw error;

  const now = new Date().toISOString();
  await Promise.all([
    admin
      .from("projects")
      .update({ status: "in_review" })
      .eq("id", projectId),
    admin.from("activity_log").insert([
      {
        tenant_id: project.tenant_id,
        project_id: project.id,
        actor_id: actorId,
        event_type: "intake.submitted",
        summary: "Intake submitted; Zinnov Intelligence analysis started",
      },
      {
        tenant_id: project.tenant_id,
        project_id: project.id,
        actor_id: actorId,
        event_type: "recommendation.generated",
        summary: `Zinnov Intelligence version ${version} generated`,
        metadata: { recommendation_id: recommendation.id, version },
        created_at: now,
      },
    ]),
  ]);

  return recommendation;
}
