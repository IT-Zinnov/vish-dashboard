import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import { generateRecommendation } from "@/lib/recommendation";
import type { IntakePayload } from "@/lib/types";

async function session() {
  const supabase = await createClient();
  const user = await getUserAllowingCookieFallback(supabase);
  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, tenant_id, access_revoked_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.access_revoked_at) {
    return { error: "Profile access is unavailable.", status: 403 } as const;
  }
  return { supabase, user, profile } as const;
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const auth = await session();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("recommendations")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ recommendation: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId =
    body && typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const auth = await session();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!["platform_admin", "team"].includes(auth.profile.role)) {
    return NextResponse.json(
      { error: "Only the delivery team can generate recommendations." },
      { status: 403 }
    );
  }

  const { data: project } = await auth.supabase
    .from("projects")
    .select("id, tenant_id, status")
    .eq("id", projectId)
    .maybeSingle();
  const { data: intake } = await auth.supabase
    .from("intakes")
    .select("id, payload")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!project || !intake) {
    return NextResponse.json({ error: "Project intake was not found." }, { status: 404 });
  }
  if (project.status === "draft") {
    return NextResponse.json(
      { error: "The intake must be submitted before analysis." },
      { status: 409 }
    );
  }

  const { data: latest } = await auth.supabase
    .from("recommendations")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version || 0) + 1;
  const output = generateRecommendation(intake.payload as IntakePayload);

  const { data: recommendation, error } = await auth.supabase
    .from("recommendations")
    .insert({
      tenant_id: project.tenant_id,
      project_id: project.id,
      intake_id: intake.id,
      version,
      status: "ready",
      assumptions: body.assumptions || {},
      output,
      generated_by: auth.user.id,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auth.supabase.from("projects").update({ status: "in_review" }).eq("id", projectId);
  await auth.supabase.from("activity_log").insert({
    tenant_id: project.tenant_id,
    project_id: project.id,
    actor_id: auth.user.id,
    event_type: "recommendation.generated",
    summary: `Recommendation version ${version} generated`,
    metadata: { recommendation_id: recommendation.id, version },
  });

  return NextResponse.json({ recommendation }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId =
    body && typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId || body.action !== "approve") {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }

  const auth = await session();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!["platform_admin", "team"].includes(auth.profile.role)) {
    return NextResponse.json(
      { error: "Only the delivery team can approve recommendations." },
      { status: 403 }
    );
  }

  const { data: recommendation } = await auth.supabase
    .from("recommendations")
    .select("id, tenant_id, project_id")
    .eq("project_id", projectId)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recommendation) {
    return NextResponse.json(
      { error: "Generate a recommendation before approving it." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("recommendations")
    .update({
      status: "approved",
      approved_by: auth.user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", recommendation.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auth.supabase.from("activity_log").insert({
    tenant_id: recommendation.tenant_id,
    project_id: recommendation.project_id,
    actor_id: auth.user.id,
    event_type: "recommendation.approved",
    summary: "Recommendation approved and handed to RACI",
    metadata: { recommendation_id: recommendation.id },
  });

  return NextResponse.json({ ok: true, status: "approved" });
}
