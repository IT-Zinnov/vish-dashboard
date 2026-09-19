import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndStoreRecommendation } from "@/lib/recommendation-service";
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
  "requiredSpaces",
] as const;

function cleanPayload(input: unknown): IntakePayload {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const payload: Record<string, string | number | string[]> = {};

  for (const key of INTAKE_KEYS) {
    const value = source[key];
    if (typeof value === "string") payload[key] = value.slice(0, 5000);
    if (typeof value === "number" && Number.isFinite(value)) payload[key] = value;
    if (
      key === "requiredSpaces" &&
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      payload[key] = value.slice(0, 25).map((item) => item.slice(0, 120));
    }
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
      .select("role, tenant_id, access_revoked_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, tenant_id, status")
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  if (!profile || profile.access_revoked_at || !project) {
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

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recommendation service is not configured.",
      },
      { status: 503 }
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

  const { error } = await admin
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

  try {
    const recommendation = await generateAndStoreRecommendation({
      projectId,
      actorId: access.user.id,
      payload,
    });

    return NextResponse.json({
      ok: true,
      status: "in_review",
      recommendation,
    });
  } catch (recommendationError) {
    return NextResponse.json(
      {
        error:
          recommendationError instanceof Error
            ? recommendationError.message
            : "The intake was saved, but analysis generation failed.",
      },
      { status: 500 }
    );
  }
}
