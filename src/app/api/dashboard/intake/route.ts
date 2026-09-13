import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import type { AppRole, IntakePayload } from "@/lib/types";

const INTAKE_KEYS = [
  "org",
  "parent",
  "industry",
  "requestType",
  "contactName",
  "contactEmail",
  "objective",
  "officeType",
  "workModel",
  "hours",
  "primaryFn",
  "phasedOcc",
  "hc1",
  "hc3",
  "hc6",
  "hc12",
  "hc24",
  "density",
  "workspaceStyle",
  "kickoff",
  "golive",
  "urgency",
  "deviceType",
  "devices",
] as const;

function cleanPayload(input: unknown): IntakePayload {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const payload: Record<string, string | number> = {};

  for (const key of INTAKE_KEYS) {
    const value = source[key];
    if (typeof value === "string") payload[key] = value.slice(0, 5000);
    if (typeof value === "number" && Number.isFinite(value)) payload[key] = value;
  }

  return payload as IntakePayload;
}

async function authorizeProject(projectId: string) {
  const supabase = await createClient();
  const user = await getUserAllowingCookieFallback(supabase);
  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const [{ data: profile }, { data: project }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, tenant_id, status")
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  if (!profile || !project) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }

  const role = profile.role as AppRole;
  const staff = role === "platform_admin" || role === "team";
  if (!staff && profile.tenant_id !== project.tenant_id) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }
  if (role === "client_viewer") {
    return { error: "View-only users cannot edit intake.", status: 403 } as const;
  }
  if (project.status !== "draft") {
    return { error: "Intake is locked after submission.", status: 409 } as const;
  }

  return { supabase, user, project } as const;
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId =
    body && typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const access = await authorizeProject(projectId);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const payload = cleanPayload(body.payload);
  const { error } = await access.supabase
    .from("intakes")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId =
    body && typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const access = await authorizeProject(projectId);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const payload = cleanPayload(body.payload);
  const saved = await access.supabase
    .from("intakes")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (saved.error) {
    return NextResponse.json({ error: saved.error.message }, { status: 400 });
  }

  const { error } = await access.supabase
    .from("projects")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: access.user.id,
    })
    .eq("id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await access.supabase.from("activity_log").insert({
    tenant_id: access.project.tenant_id,
    project_id: projectId,
    actor_id: access.user.id,
    event_type: "intake.submitted",
    summary: "Client intake submitted for delivery-team review",
  });

  return NextResponse.json({ ok: true, status: "submitted" });
}
