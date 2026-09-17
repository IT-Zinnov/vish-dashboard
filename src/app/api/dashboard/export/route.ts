import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAllowingCookieFallback } from "@/lib/supabase/get-user";

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
      .select("role, tenant_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, tenant_id, name, status, raci_published_at")
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  if (!profile || !project) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }
  const staff = profile.role === "platform_admin" || profile.role === "team";
  if (!staff && profile.tenant_id !== project.tenant_id) {
    return { error: "Project not found or access denied.", status: 404 } as const;
  }
  return { supabase, user, profile, project, staff } as const;
}

function flatten(
  input: unknown,
  prefix = "",
  rows: Array<[string, string]> = []
) {
  if (input === null || input === undefined) {
    rows.push([prefix, ""]);
  } else if (Array.isArray(input)) {
    input.forEach((value, index) => flatten(value, `${prefix}[${index + 1}]`, rows));
  } else if (typeof input === "object") {
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) =>
      flatten(value, prefix ? `${prefix}.${key}` : key, rows)
    );
  } else {
    rows.push([prefix, String(input)]);
  }
  return rows;
}

function csv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\r\n");
}

async function workbook(
  title: string,
  rows: Array<Array<string | number | null | undefined>>
) {
  const book = new ExcelJS.Workbook();
  book.creator = "Zinnov Dashboard";
  const sheet = book.addWorksheet(title.slice(0, 31));
  rows.forEach((row) => sheet.addRow(row));
  const first = sheet.getRow(1);
  first.font = { bold: true, color: { argb: "FFFFFFFF" } };
  first.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B1F3A" },
  };
  sheet.columns.forEach((column) => {
    column.width = Math.min(
      50,
      Math.max(
        14,
        ...(column.values || []).map((value) => String(value ?? "").length + 2)
      )
    );
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function pdf(title: string, sections: Array<[string, string]>) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595, 842]);
  let y = 790;

  const newPage = () => {
    page = document.addPage([595, 842]);
    y = 800;
  };
  const write = (text: string, isBold = false, size = 10) => {
    const words = text.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if ((isBold ? bold : regular).widthOfTextAtSize(candidate, size) > 500) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.forEach((value) => {
      if (y < 45) newPage();
      page.drawText(value, {
        x: 45,
        y,
        size,
        font: isBold ? bold : regular,
        color: rgb(0.05, 0.12, 0.23),
      });
      y -= size + 5;
    });
  };

  write("ZINNOV DASHBOARD", true, 9);
  y -= 5;
  write(title, true, 20);
  y -= 16;
  sections.forEach(([label, value]) => {
    write(label, true, 10);
    write(value || "—", false, 10);
    y -= 7;
  });
  return Buffer.from(await document.save());
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

  const [{ data: intake }, { data: recommendation }, { data: raci }] =
    await Promise.all([
      admin.from("intakes").select("payload").eq("project_id", projectId).single(),
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
          "workstream, responsible, accountable, consulted, informed, due_date, status"
        )
        .eq("project_id", projectId)
        .order("sort_order"),
    ]);

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

  let bytes: Buffer;
  if (exportType.startsWith("raci_")) {
    const rows = [
      ["Workstream", "Responsible", "Accountable", "Consulted", "Informed", "Due date", "Status"],
      ...(raci || []).map((row) => [
        row.workstream,
        row.responsible,
        row.accountable,
        row.consulted,
        row.informed,
        row.due_date,
        row.status,
      ]),
    ];
    bytes = isCsv ? Buffer.from(csv(rows), "utf8") : await workbook("RACI", rows);
  } else {
    const source = exportType.startsWith("intake_")
      ? intake?.payload || {}
      : recommendation?.output || {};
    const flat = flatten(source);
    if (isPdf) {
      bytes = await pdf(
        exportType.startsWith("dashboard_")
          ? `${access.project.name} — Project Dashboard`
          : `${access.project.name} — Zinnov Intelligence`,
        flat
      );
    } else {
      bytes = await workbook(
        exportType.startsWith("dashboard_") ? "Dashboard" : exportType.startsWith("intake_") ? "Intake" : "Intelligence",
        [["Metric", "Value"], ...flat]
      );
    }
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
