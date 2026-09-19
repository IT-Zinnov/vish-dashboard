import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import type { IntakePayload } from "@/lib/types";
import type {
  ProjectExportData,
  RecommendationOutput,
} from "@/lib/exports/types";
import {
  buildCsv,
  buildDashboardWorkbook,
  buildIntakeWorkbook,
  buildIntelligenceWorkbook,
  buildRaciWorkbook,
  intakeCsvRows,
  raciCsvRows,
} from "@/lib/exports/spreadsheets";
import {
  buildDashboardPdf,
  buildIntelligencePdf,
} from "@/lib/exports/pdf-reports";

export const runtime = "nodejs";

const EXPORT_TYPES = [
  "intake_xlsx",
  "intake_csv",
  "intelligence_xlsx",
  "intelligence_pdf",
  "dashboard_xlsx",
  "dashboard_pdf",
  "raci_xlsx",
  "raci_csv",
] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

async function authorizeProject(projectId: string) {
  const supabase = await createClient();
  const user = await getUserAllowingCookieFallback(supabase);
  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const [{ data: profile }, { data: project }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, tenant_id, access_revoked_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, tenant_id, name, status, raci_published_at, is_demo, tenants(name)")
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  if (!profile || profile.access_revoked_at || !project) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }
  const staff = profile.role === "platform_admin" || profile.role === "team";
  if (!staff && profile.tenant_id !== project.tenant_id) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }
  return { supabase, user, profile, project, staff } as const;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const exportType = body?.exportType as ExportType;
  if (!projectId || !EXPORT_TYPES.includes(exportType)) {
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  }

  const access = await authorizeProject(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (
    exportType.startsWith("raci_") &&
    !access.staff &&
    !access.project.raci_published_at
  ) {
    return NextResponse.json(
      { error: "RACI has not been published to the client." },
      { status: 403 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export service unavailable." },
      { status: 503 }
    );
  }

  const [
    { data: intake, error: intakeError },
    { data: recommendation, error: recommendationError },
    { data: raci, error: raciError },
  ] =
    await Promise.all([
      admin
        .from("intakes")
        .select("payload")
        .eq("project_id", projectId)
        .maybeSingle(),
      admin
        .from("recommendations")
        .select("output, version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("raci_rows")
        .select(
          "workstream, responsible, responsible_email, accountable, accountable_email, consulted, consulted_email, informed, informed_email, due_date, status"
        )
        .eq("project_id", projectId)
        .order("sort_order"),
    ]);

  if (intakeError || recommendationError || raciError) {
    return NextResponse.json(
      {
        error:
          intakeError?.message ||
          recommendationError?.message ||
          raciError?.message ||
          "Unable to load project export data.",
      },
      { status: 500 }
    );
  }

  const needsIntake =
    exportType.startsWith("intake_") ||
    exportType.startsWith("intelligence_") ||
    exportType.startsWith("dashboard_");
  const needsRecommendation =
    exportType.startsWith("intelligence_") ||
    exportType.startsWith("dashboard_");
  if (needsIntake && (!intake?.payload || !Object.keys(intake.payload).length)) {
    return NextResponse.json(
      { error: "This project has no submitted intake data to export." },
      { status: 422 }
    );
  }
  if (
    needsRecommendation &&
    (!recommendation?.output || !Object.keys(recommendation.output).length)
  ) {
    return NextResponse.json(
      { error: "Zinnov Intelligence has not been generated for this project." },
      { status: 422 }
    );
  }
  if (exportType.startsWith("raci_") && !(raci || []).length) {
    return NextResponse.json(
      { error: "This project has no RACI assignments to export." },
      { status: 422 }
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const baseName = access.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const isCsv = exportType.endsWith("_csv");
  const isPdf = exportType.endsWith("_pdf");
  const extension = isCsv ? "csv" : isPdf ? "pdf" : "xlsx";
  const fileName = `${baseName}-${exportType.replace("_", "-")}-${date}.${extension}`;
  const mimeType = isCsv
    ? "text/csv; charset=utf-8"
    : isPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const tenantRelation = access.project.tenants as
    | { name?: string }
    | Array<{ name?: string }>
    | null;
  const clientName = Array.isArray(tenantRelation)
    ? tenantRelation[0]?.name || "Client"
    : tenantRelation?.name || "Client";
  const exportData: ProjectExportData = {
    project: {
      id: access.project.id,
      name: access.project.name,
      status: access.project.status,
      is_demo: Boolean(access.project.is_demo),
    },
    clientName,
    intake: (intake?.payload || {}) as IntakePayload,
    recommendation: (recommendation?.output || {}) as RecommendationOutput,
    recommendationVersion: recommendation?.version,
    raci: raci || [],
    generatedAt: new Date().toISOString(),
  };

  let bytes: Buffer;
  switch (exportType) {
    case "intake_csv":
      bytes = Buffer.from(buildCsv(intakeCsvRows(exportData)), "utf8");
      break;
    case "raci_csv":
      bytes = Buffer.from(buildCsv(raciCsvRows(exportData)), "utf8");
      break;
    case "intake_xlsx":
      bytes = await buildIntakeWorkbook(exportData);
      break;
    case "intelligence_xlsx":
      bytes = await buildIntelligenceWorkbook(exportData);
      break;
    case "dashboard_xlsx":
      bytes = await buildDashboardWorkbook(exportData);
      break;
    case "raci_xlsx":
      bytes = await buildRaciWorkbook(exportData);
      break;
    case "intelligence_pdf":
      bytes = await buildIntelligencePdf(exportData);
      break;
    case "dashboard_pdf":
      bytes = await buildDashboardPdf(exportData);
      break;
  }

  const { data: exportRow, error: createError } = await admin
    .from("exports")
    .insert({
      tenant_id: access.project.tenant_id,
      project_id: projectId,
      requested_by: access.user.id,
      export_type: exportType,
      status: "processing",
      file_name: fileName,
      mime_type: mimeType,
    })
    .select("id")
    .single();
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const storagePath = `${access.project.tenant_id}/${projectId}/${exportRow.id}/${fileName}`;
  const { error: uploadError } = await admin.storage
    .from("project-exports")
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) {
    await admin
      .from("exports")
      .update({ status: "failed", error_message: uploadError.message })
      .eq("id", exportRow.id);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await Promise.all([
    admin
      .from("exports")
      .update({
        status: "ready",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
      })
      .eq("id", exportRow.id),
    admin.from("activity_log").insert({
      tenant_id: access.project.tenant_id,
      project_id: projectId,
      actor_id: access.user.id,
      event_type: "export.generated",
      summary: `${exportType.replace(/_/g, " ")} generated`,
      metadata: { export_id: exportRow.id, file_name: fileName },
    }),
  ]);

  const { data: signed, error: signedError } = await admin.storage
    .from("project-exports")
    .createSignedUrl(storagePath, 60);
  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    exportId: exportRow.id,
    fileName,
    downloadUrl: signed.signedUrl,
  });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("scope") === "projects") {
    const supabase = await createClient();
    const user = await getUserAllowingCookieFallback(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("access_revoked_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.access_revoked_at) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, is_demo, tenants(name)")
      .order("is_demo", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ projects: data || [] });
  }

  const projectId = request.nextUrl.searchParams.get("projectId") || "";
  const exportId = request.nextUrl.searchParams.get("exportId");
  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }
  const access = await authorizeProject(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let query = access.supabase
    .from("exports")
    .select("id, export_type, status, file_name, storage_path, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (exportId) query = query.eq("id", exportId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (exportId) {
    const item = data?.[0];
    if (!item?.storage_path) {
      return NextResponse.json({ error: "Export is not ready." }, { status: 404 });
    }
    const admin = createAdminClient();
    const { data: signed, error: signedError } = await admin.storage
      .from("project-exports")
      .createSignedUrl(item.storage_path, 60);
    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }
    return NextResponse.json({ export: item, downloadUrl: signed.signedUrl });
  }

  return NextResponse.json({ exports: data || [] });
}
