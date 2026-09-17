import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";
import type { AppRole } from "@/lib/types";

export const dynamic = "force-dynamic";

let prototypeTemplate: Promise<string> | null = null;

function getPrototypeTemplate() {
  if (!prototypeTemplate) {
    prototypeTemplate = readFile(
      path.join(process.cwd(), "prototype", "zinnov_coe_v3_10_1.html"),
      "utf8"
    );
  }
  return prototypeTemplate;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getUserAllowingCookieFallback(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as AppRole | undefined;
  const staff = role === "platform_admin" || role === "team";
  const requestedProject = request.nextUrl.searchParams.get("project");
  let projectQuery = supabase
    .from("projects")
    .select(
      "id, tenant_id, name, status, created_at, submitted_at, published_at, raci_published_at"
    )
    .order("created_at", { ascending: false })
    .limit(1);

  if (requestedProject) projectQuery = projectQuery.eq("id", requestedProject);
  if (!staff && profile?.tenant_id) {
    projectQuery = projectQuery.eq("tenant_id", profile.tenant_id);
  }
  if (!staff && !profile?.tenant_id) {
    projectQuery = projectQuery.eq("tenant_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: projects } = await projectQuery;
  const project = projects?.[0] ?? null;
  const tenantId = project?.tenant_id ?? profile?.tenant_id ?? null;
  const [
    { data: tenant },
    { data: intake },
    { data: recommendation },
    { data: projectRaci },
  ] = await Promise.all([
    tenantId
      ? supabase.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    project
      ? supabase
          .from("intakes")
          .select("payload, updated_at")
          .eq("project_id", project.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    project
      ? supabase
          .from("recommendations")
          .select("id, version, status, output, generated_at:created_at")
          .eq("project_id", project.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    project
      ? supabase
          .from("raci_rows")
          .select(
            "id, workstream, responsible, accountable, consulted, informed, status, due_date, locked, sort_order"
          )
          .eq("project_id", project.id)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);

  let portfolioQuery = supabase
    .from("projects")
    .select(
      "id, tenant_id, name, status, created_at, submitted_at, tenants(name), intakes(payload, updated_at)"
    )
    .order("created_at", { ascending: false })
    .limit(8);
  if (!staff && profile?.tenant_id) {
    portfolioQuery = portfolioQuery.eq("tenant_id", profile.tenant_id);
  }
  const { data: portfolioProjects } = await portfolioQuery;

  const projectIds = (portfolioProjects || []).map((item) => item.id);
  let activityQuery = supabase
    .from("activity_log")
    .select(
      "id, tenant_id, project_id, event_type, summary, created_at, projects(name), profiles(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(8);
  if (!staff && profile?.tenant_id) {
    activityQuery = activityQuery.eq("tenant_id", profile.tenant_id);
  }

  const [
    { data: recommendations },
    { data: raciRows },
    { data: activity },
    { data: exports },
    { count: caseStudyCount },
  ] =
    await Promise.all([
      projectIds.length
        ? supabase
            .from("recommendations")
            .select("id, project_id, status")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      projectIds.length
        ? supabase
            .from("raci_rows")
            .select("id, project_id, status, due_date")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      activityQuery,
      projectIds.length
        ? supabase
            .from("exports")
            .select("id, project_id, status")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("case_studies")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const openRaci = (raciRows || []).filter(
    (row) => row.status !== "completed"
  );
  const canEdit =
    Boolean(project) &&
    project?.status === "draft" &&
    role !== "client_viewer";
  const readyForReview = (portfolioProjects || []).filter(
    (item) => item.status === "submitted" || item.status === "in_review"
  ).length;
  const awaitingInputs = (portfolioProjects || []).filter(
    (item) => item.status === "draft"
  ).length;
  const intelligenceReady = Boolean(recommendation);
  const raciPublished =
    staff ||
    Boolean(
      project?.raci_published_at &&
        project &&
        ["published", "execution"].includes(project.status)
    );
  const context = {
    user: profile
      ? {
          id: profile.id,
          name: profile.full_name,
          email: profile.email,
          role,
        }
      : { id: user.id, name: null, email: user.email, role: null },
    tenant,
    project,
    intake: intake?.payload ?? {},
    recommendation,
    raci: raciPublished ? projectRaci || [] : [],
    permissions: {
      staff,
      canEdit,
      canSubmit: canEdit,
      intelligenceReady,
      raciPublished,
    },
    portfolio: {
      projects: portfolioProjects || [],
      activity: activity || [],
      summary: {
        activeIntakes: (portfolioProjects || []).filter(
          (item) =>
            item.status === "draft" ||
            item.status === "submitted" ||
            item.status === "in_review"
        ).length,
        recommendations: (recommendations || []).filter(
          (item) => item.status === "ready" || item.status === "approved"
        ).length,
        openRaci: openRaci.length,
        overdueRaci: openRaci.filter(
          (item) => item.due_date && item.due_date < today
        ).length,
        awaitingInputs,
        readyForReview,
        repositoryProjects: caseStudyCount || 0,
        exportsGenerated: (exports || []).filter(
          (item) => item.status === "ready"
        ).length,
      },
    },
  };

  try {
    const html = await getPrototypeTemplate();
    const serializedContext = JSON.stringify(context).replace(/</g, "\\u003c");
    const bootstrap = `<script>window.__COE_CONTEXT__=${serializedContext};</script><script src="/dashboard-bridge.js"></script>`;
    const hydratedHtml = html.includes("</body>")
      ? html.replace("</body>", `${bootstrap}</body>`)
      : `${html}${bootstrap}`;

    return new NextResponse(hydratedHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy":
          "frame-ancestors 'self'; object-src 'self' data: blob:",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Dashboard prototype file is unavailable." },
      { status: 500 }
    );
  }
}
