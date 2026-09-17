"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndStoreRecommendation } from "@/lib/recommendation-service";
import { DEFAULT_RACI, type IntakePayload } from "@/lib/types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTenantAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile?.role !== "platform_admin") return { error: "Only the platform admin can onboard clients." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Client name is required." };
  const slug = slugify(name) || `client-${Date.now()}`;

  const { data, error } = await supabase
    .from("tenants")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/master");
  return { id: data.id };
}

export async function inviteUserAction(formData: FormData) {
  const { supabase, user, profile } = await requireStaff();
  if (profile?.role !== "platform_admin") return { error: "Only the platform admin can invite users." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "client_contributor");
  const tenantId = String(formData.get("tenant_id") || "") || null;

  if (!email) return { error: "Email is required." };
  if (role.startsWith("client") && !tenantId) {
    return { error: "Pick a client company for this invite." };
  }

  const { error } = await supabase.from("invites").insert({
    email,
    role,
    tenant_id: role.startsWith("client") ? tenantId : null,
    invited_by: user!.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/master");
  if (tenantId) revalidatePath(`/master/tenants/${tenantId}`);
  return { ok: true };
}

export async function assignUserAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile?.role !== "platform_admin") {
    return { error: "Only the platform admin can assign users." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "client_contributor");
  const tenantId = String(formData.get("tenant_id") || "") || null;

  if (!email) return { error: "Email is required." };
  if (role.startsWith("client") && !tenantId) {
    return { error: "Pick a client company for this user." };
  }

  const { data, error } = await supabase.rpc("admin_assign_profile", {
    target_email: email,
    target_tenant: tenantId,
    target_role: role,
  });
  if (error) {
    if (/could not find the function|PGRST202/i.test(error.message)) {
      return {
        error:
          "Run supabase/migrations/005_apply_invites_to_existing_users.sql in the Supabase SQL Editor first.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/master");
  if (tenantId) revalidatePath(`/master/tenants/${tenantId}`);
  return { outcome: (data as { outcome?: string } | null)?.outcome ?? "done" };
}

export async function createProjectAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const tenantId = String(formData.get("tenant_id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!tenantId || !name) return { error: "Client and project name are required." };

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ tenant_id: tenantId, name, created_by: user!.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("intakes").insert({
    tenant_id: tenantId,
    project_id: project.id,
    payload: {},
  });

  await supabase.from("raci_rows").insert(
    DEFAULT_RACI.map((row, i) => ({
      tenant_id: tenantId,
      project_id: project.id,
      ...row,
      sort_order: i,
    }))
  );

  revalidatePath("/master");
  revalidatePath("/portal");
  return { id: project.id };
}

export async function saveIntakeAction(projectId: string, payload: IntakePayload) {
  const { supabase, profile } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status, tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Project not found." };
  if (project.status !== "draft") return { error: "Intake is locked after submit." };
  if (profile?.role === "client_viewer") return { error: "Viewers cannot edit intake." };

  const { error } = await supabase
    .from("intakes")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath(`/master/projects/${projectId}`);
  return { ok: true };
}

export async function submitIntakeAction(projectId: string, payload: IntakePayload) {
  const { supabase, user, profile } = await requireUser();
  if (profile?.role === "client_viewer") return { error: "Viewers cannot submit intake." };
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Recommendation service is not configured.",
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Project not found." };
  if (project.status !== "draft") return { error: "This intake is already submitted." };

  const save = await supabase
    .from("intakes")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (save.error) return { error: save.error.message };

  const { error } = await admin
    .from("projects")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: user!.id,
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  try {
    await generateAndStoreRecommendation({
      projectId,
      actorId: user!.id,
      payload,
    });
  } catch (recommendationError) {
    return {
      error:
        recommendationError instanceof Error
          ? recommendationError.message
          : "The intake was saved, but analysis generation failed.",
    };
  }

  revalidatePath("/portal");
  revalidatePath("/master");
  revalidatePath(`/dashboard?project=${projectId}`);
  return { ok: true, status: "in_review" };
}

export async function reopenIntakeAction(projectId: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("projects")
    .update({ status: "draft", submitted_at: null, submitted_by: null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/master/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return { ok: true };
}

export async function advanceProjectAction(projectId: string, status: string) {
  const { supabase } = await requireStaff();
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/master/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return { ok: true };
}

export async function approveRecommendationAction(projectId: string) {
  const { supabase, user } = await requireStaff();
  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("id, tenant_id, status")
    .eq("project_id", projectId)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recommendation) {
    return { error: "No recommendation is waiting for approval." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("recommendations")
    .update({
      status: "approved",
      approved_by: user!.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", recommendation.id);
  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    tenant_id: recommendation.tenant_id,
    project_id: projectId,
    actor_id: user!.id,
    event_type: "recommendation.approved",
    summary: "Zinnov Intelligence approved; RACI assignment can proceed",
  });
  revalidatePath(`/master/projects/${projectId}`);
  revalidatePath(`/dashboard?project=${projectId}`);
  return { ok: true };
}

export async function publishRaciAction(projectId: string) {
  const { supabase, user, profile } = await requireStaff();
  if (profile?.role !== "platform_admin") {
    return { error: "Only the platform admin can publish RACI to the client." };
  }

  const { data: approvedRecommendation } = await supabase
    .from("recommendations")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!approvedRecommendation) {
    return {
      error:
        "Approve the Zinnov Intelligence recommendation before publishing RACI.",
    };
  }

  const { data: rows, error: rowsError } = await supabase
    .from("raci_rows")
    .select("responsible, accountable")
    .eq("project_id", projectId);
  if (rowsError) return { error: rowsError.message };
  if (
    !rows?.length ||
    rows.some((row) => !row.responsible?.trim() || !row.accountable?.trim())
  ) {
    return {
      error:
        "Assign both Responsible and Accountable for every workstream before publishing.",
    };
  }

  const now = new Date().toISOString();
  const { data: project, error } = await supabase
    .from("projects")
    .update({
      status: "published",
      published_at: now,
      raci_published_at: now,
      raci_published_by: user!.id,
    })
    .eq("id", projectId)
    .select("tenant_id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    tenant_id: project.tenant_id,
    project_id: projectId,
    actor_id: user!.id,
    event_type: "raci.published",
    summary: "RACI assignments and delivery plan published to the client",
  });

  revalidatePath(`/master/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath(`/dashboard?project=${projectId}`);
  return { ok: true };
}

export async function saveRaciAction(
  projectId: string,
  rows: {
    id: string;
    responsible: string;
    accountable: string;
    consulted: string;
    informed: string;
    dueDate?: string;
    status?: string;
  }[]
) {
  const { supabase } = await requireStaff();
  const { data: approvedRecommendation } = await supabase
    .from("recommendations")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!approvedRecommendation) {
    return {
      error: "Approve Zinnov Intelligence before assigning RACI.",
    };
  }
  for (const row of rows) {
    const { error } = await supabase
      .from("raci_rows")
      .update({
        responsible: row.responsible,
        accountable: row.accountable,
        consulted: row.consulted,
        informed: row.informed,
        due_date: row.dueDate || null,
        status: row.status || "unassigned",
      })
      .eq("id", row.id)
      .eq("project_id", projectId);
    if (error) return { error: error.message };
  }
  revalidatePath(`/master/projects/${projectId}`);
  return { ok: true };
}
