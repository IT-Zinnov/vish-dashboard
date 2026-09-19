import ExcelJS from "exceljs";
import type { ProjectExportData } from "@/lib/exports/types";

const NAVY = "FF0A1628";
const BLUE = "FF1255CC";
const PALE_BLUE = "FFEEF4FF";
const ORANGE = "FFF26522";
const WHITE = "FFFFFFFF";
const BORDER = "FFD9E2F0";

type CellValue = string | number | null | undefined;

function createBook(data: ProjectExportData) {
  const book = new ExcelJS.Workbook();
  book.creator = "Zinnov Dashboard";
  book.company = "Zinnov";
  book.created = new Date(data.generatedAt);
  book.modified = new Date(data.generatedAt);
  book.subject = `${data.clientName} — ${data.project.name}`;
  book.title = `${data.project.name} project export`;
  return book;
}

function titleSheet(
  book: ExcelJS.Workbook,
  name: string,
  title: string,
  data: ProjectExportData
) {
  const sheet = book.addWorksheet(name.slice(0, 31), {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.columns = [
    { key: "label", width: 31 },
    { key: "value", width: 32 },
    { key: "extra", width: 26 },
    { key: "extra2", width: 26 },
    { key: "extra3", width: 22 },
    { key: "extra4", width: 22 },
    { key: "extra5", width: 18 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "ZINNOV DASHBOARD";
  sheet.getCell("A1").font = { bold: true, color: { argb: WHITE }, size: 11 };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 25;

  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { bold: true, color: { argb: NAVY }, size: 20 };
  sheet.getRow(2).height = 30;

  sheet.mergeCells("A3:G3");
  sheet.getCell("A3").value = `${data.clientName} — ${data.project.name}${data.project.is_demo ? "  |  DEMONSTRATION DATA" : ""}`;
  sheet.getCell("A3").font = {
    bold: true,
    color: { argb: data.project.is_demo ? ORANGE : BLUE },
    size: 12,
  };
  sheet.mergeCells("A4:G4");
  sheet.getCell("A4").value = `Project status: ${human(data.project.status)}  |  Generated: ${formatDateTime(data.generatedAt)}`;
  sheet.getCell("A4").font = { color: { argb: "FF64748B" }, size: 10 };
  sheet.getRow(5).height = 7;
  sheet.headerFooter.oddFooter = "&LZinnov Dashboard&CConfidential&RPage &P of &N";
  return sheet;
}

function section(sheet: ExcelJS.Worksheet, title: string) {
  const row = sheet.addRow([title]);
  sheet.mergeCells(row.number, 1, row.number, 7);
  row.height = 22;
  const cell = row.getCell(1);
  cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  cell.alignment = { vertical: "middle" };
  return row.number;
}

function keyValues(
  sheet: ExcelJS.Worksheet,
  values: Array<[string, CellValue]>,
  columns: 1 | 2 = 2
) {
  for (let index = 0; index < values.length; index += columns) {
    const row = sheet.addRow([]);
    const pairs = values.slice(index, index + columns);
    pairs.forEach(([label, value], pairIndex) => {
      const start = pairIndex * 3 + 1;
      row.getCell(start).value = label;
      row.getCell(start).font = { bold: true, color: { argb: NAVY } };
      row.getCell(start).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE_BLUE } };
      row.getCell(start + 1).value = value ?? "—";
      row.getCell(start + 1).alignment = { wrapText: true, vertical: "top" };
      sheet.mergeCells(row.number, start + 1, row.number, start + 2);
      for (let cellIndex = start; cellIndex <= start + 2; cellIndex += 1) {
        row.getCell(cellIndex).border = {
          bottom: { style: "thin", color: { argb: BORDER } },
        };
      }
    });
  }
  sheet.addRow([]);
}

function table(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  rows: CellValue[][],
  name: string
) {
  const start = sheet.rowCount + 1;
  sheet.addTable({
    name: name.replace(/[^a-z0-9]/gi, ""),
    ref: `A${start}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: headers.map((headerName) => ({ name: headerName })),
    rows: rows.map((row) => row.map((value) => value ?? "—")),
  });
  const header = sheet.getRow(start);
  header.font = { bold: true, color: { argb: WHITE } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", wrapText: true };
  for (let rowIndex = start + 1; rowIndex <= start + rows.length; rowIndex += 1) {
    sheet.getRow(rowIndex).alignment = { vertical: "top", wrapText: true };
  }
  sheet.addRow([]);
}

function human(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function percent(value?: number) {
  if (value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function summaryValues(data: ProjectExportData): Array<[string, CellValue]> {
  const { intake, recommendation } = data;
  return [
    ["Client", data.clientName],
    ["Project", data.project.name],
    ["Project status", human(data.project.status)],
    ["Industry", intake.industry],
    ["Office type", recommendation.basis?.officeType || intake.officeType],
    ["Work model", intake.workModel],
    ["Day-one headcount", recommendation.basis?.headcount ?? intake.hc1],
    ["Month-24 headcount", recommendation.basis?.month24Headcount ?? intake.hc24],
    ["Day-one area (sq ft)", recommendation.workplace?.dayOneAreaSqft],
    ["Month-24 area (sq ft)", recommendation.workplace?.month24AreaSqft],
    ["Workstations", recommendation.workplace?.workstations],
    ["Utilization target", recommendation.workplace?.utilizationTarget ? `${recommendation.workplace.utilizationTarget}%` : "—"],
  ];
}

function addSourceIntakeSheet(book: ExcelJS.Workbook, data: ProjectExportData) {
  const sheet = titleSheet(book, "Source Intake", "Submitted Intake Inputs", data);
  section(sheet, "Complete source data");
  keyValues(sheet, [
    ["Organization", data.intake.org],
    ["Parent group", data.intake.parent],
    ["Industry", data.intake.industry],
    ["Request type", data.intake.requestType],
    ["Contact name", data.intake.contactName],
    ["Contact email", data.intake.contactEmail],
    ["Objective", data.intake.objective],
    ["Office type", data.intake.officeType],
    ["Work model", data.intake.workModel],
    ["Operating hours", data.intake.hours],
    ["Primary function", data.intake.primaryFn],
    ["Phased occupancy", data.intake.phasedOcc],
    ["Month 1 headcount", data.intake.hc1],
    ["Month 3 headcount", data.intake.hc3],
    ["Month 6 headcount", data.intake.hc6],
    ["Month 12 headcount", data.intake.hc12],
    ["Month 24 headcount", data.intake.hc24],
    ["Density (sq ft/FTE)", data.intake.density],
    ["Workspace style", data.intake.workspaceStyle],
    [
      "Required spaces",
      data.intake.requiredSpaces?.length
        ? data.intake.requiredSpaces.join(", ")
        : "Not captured",
    ],
    ["Kickoff", data.intake.kickoff],
    ["Target go-live", data.intake.golive],
    ["Urgency", data.intake.urgency],
    ["Device type", data.intake.deviceType],
    ["Device count", data.intake.devices],
  ]);
  return sheet;
}

async function bytes(book: ExcelJS.Workbook) {
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function buildIntakeWorkbook(data: ProjectExportData) {
  const book = createBook(data);
  const sheet = titleSheet(book, "Intake Summary", "Client Intake Report", data);
  section(sheet, "Organization and request");
  keyValues(sheet, [
    ["Organization", data.intake.org],
    ["Parent group", data.intake.parent],
    ["Industry", data.intake.industry],
    ["Request type", data.intake.requestType],
    ["Objective", data.intake.objective],
    ["Primary function", data.intake.primaryFn],
  ]);
  section(sheet, "Primary contact");
  keyValues(sheet, [
    ["Contact name", data.intake.contactName],
    ["Contact email", data.intake.contactEmail],
  ]);
  section(sheet, "Workplace requirements");
  keyValues(sheet, [
    ["Office type", data.intake.officeType],
    ["Work model", data.intake.workModel],
    ["Operating hours", data.intake.hours],
    ["Workspace style", data.intake.workspaceStyle],
    ["Phased occupancy", data.intake.phasedOcc],
    ["Density (sq ft/FTE)", data.intake.density],
    [
      "Required spaces",
      data.intake.requiredSpaces?.length
        ? data.intake.requiredSpaces.join(", ")
        : "Not captured",
    ],
  ]);
  section(sheet, "Headcount ramp");
  table(
    sheet,
    ["Milestone", "Month 1", "Month 3", "Month 6", "Month 12", "Month 24"],
    [["Headcount (FTE)", data.intake.hc1, data.intake.hc3, data.intake.hc6, data.intake.hc12, data.intake.hc24]],
    "IntakeHeadcount"
  );
  section(sheet, "Technology and schedule");
  keyValues(sheet, [
    ["Device type", data.intake.deviceType],
    ["Device count", data.intake.devices],
    ["Kickoff", data.intake.kickoff],
    ["Target go-live", data.intake.golive],
    ["Urgency", data.intake.urgency],
    ["Exported at", formatDateTime(data.generatedAt)],
  ]);
  return bytes(book);
}

export async function buildIntelligenceWorkbook(data: ProjectExportData) {
  const book = createBook(data);
  const summary = titleSheet(book, "Executive Summary", "Zinnov Intelligence Report", data);
  section(summary, "Recommendation highlights");
  keyValues(summary, summaryValues(data));
  section(summary, "Risks and attention points");
  table(
    summary,
    ["#", "Risk / attention point"],
    (data.recommendation.risks?.length ? data.recommendation.risks : ["No material risks identified."]).map((risk, index) => [index + 1, risk]),
    "IntelligenceRisks"
  );

  const workplace = titleSheet(book, "Workplace", "Workplace Recommendation", data);
  section(workplace, "Space and workplace configuration");
  keyValues(workplace, [
    ["Workstations", data.recommendation.workplace?.workstations],
    ["Meeting rooms", data.recommendation.workplace?.meetingRooms],
    ["Meeting seats", data.recommendation.workplace?.meetingSeats],
    ["Collaboration seats", data.recommendation.workplace?.collaborationSeats],
    ["Café seats", data.recommendation.workplace?.cafeSeats],
    ["Desk share", percent(data.recommendation.workplace?.deskShare)],
    ["Day-one area (sq ft)", data.recommendation.workplace?.dayOneAreaSqft],
    ["Month-24 area (sq ft)", data.recommendation.workplace?.month24AreaSqft],
    ["Utilization target", data.recommendation.workplace?.utilizationTarget ? `${data.recommendation.workplace.utilizationTarget}%` : "—"],
    ["Benchmark range (sq ft/FTE)", data.recommendation.workplace?.benchmarkAreaRange?.join(" – ")],
  ]);

  const infrastructure = titleSheet(book, "Infrastructure", "Technology and Infrastructure", data);
  section(infrastructure, "Infrastructure sizing");
  keyValues(infrastructure, [
    ["Endpoint devices", data.recommendation.infrastructure?.devices],
    ["Cabling ports", data.recommendation.infrastructure?.estimatedCablingPorts],
    ["Cable length (metres)", data.recommendation.infrastructure?.estimatedCableMetres],
    ["Server racks", data.recommendation.infrastructure?.estimatedServerRacks],
    ["Kickoff", data.recommendation.schedule?.kickoff],
    ["Go-live", data.recommendation.schedule?.goLive],
    ["Methodology", data.recommendation.methodologyVersion],
    ["Recommendation version", data.recommendationVersion],
  ]);
  addSourceIntakeSheet(book, data);
  return bytes(book);
}

export async function buildDashboardWorkbook(data: ProjectExportData) {
  const book = createBook(data);
  const summary = titleSheet(book, "Dashboard", "Project Management Dashboard", data);
  section(summary, "Executive KPIs");
  keyValues(summary, summaryValues(data));
  section(summary, "Headcount and area projection");
  table(
    summary,
    ["Metric", "Day one", "Month 3", "Month 6", "Month 12", "Month 24"],
    [
      ["Headcount", data.intake.hc1, data.intake.hc3, data.intake.hc6, data.intake.hc12, data.intake.hc24],
      [
        "Area (sq ft)",
        data.recommendation.workplace?.dayOneAreaSqft,
        data.intake.hc3 && data.intake.density ? data.intake.hc3 * data.intake.density : null,
        data.intake.hc6 && data.intake.density ? data.intake.hc6 * data.intake.density : null,
        data.intake.hc12 && data.intake.density ? data.intake.hc12 * data.intake.density : null,
        data.recommendation.workplace?.month24AreaSqft,
      ],
    ],
    "DashboardProjection"
  );
  section(summary, "RACI status");
  const statusCounts = data.raci.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
  table(
    summary,
    ["Status", "Workstreams"],
    Object.entries(statusCounts).map(([status, count]) => [human(status), count]),
    "DashboardRaciStatus"
  );
  addRaciSheet(book, data);
  addSourceIntakeSheet(book, data);
  return bytes(book);
}

function addRaciSheet(book: ExcelJS.Workbook, data: ProjectExportData) {
  const sheet = titleSheet(book, "RACI", "RACI Assignment Matrix", data);
  for (const row of [1, 2, 3, 4]) {
    sheet.unMergeCells(`A${row}:G${row}`);
    sheet.mergeCells(`A${row}:K${row}`);
  }
  const sectionRow = section(sheet, "Published assignments");
  sheet.unMergeCells(`A${sectionRow}:G${sectionRow}`);
  sheet.mergeCells(`A${sectionRow}:K${sectionRow}`);
  table(
    sheet,
    [
      "Workstream",
      "Responsible",
      "Responsible email",
      "Accountable",
      "Accountable email",
      "Consulted",
      "Consulted email",
      "Informed",
      "Informed email",
      "Due date",
      "Status",
    ],
    data.raci.map((row) => [
      row.workstream,
      row.responsible,
      row.responsible_email,
      row.accountable,
      row.accountable_email,
      row.consulted,
      row.consulted_email,
      row.informed,
      row.informed_email,
      row.due_date,
      human(row.status),
    ]),
    `Raci${book.worksheets.length}`
  );
  sheet.getColumn(1).width = 30;
  for (let column = 2; column <= 9; column += 1) sheet.getColumn(column).width = 24;
  sheet.getColumn(10).width = 15;
  sheet.getColumn(11).width = 16;
  return sheet;
}

export async function buildRaciWorkbook(data: ProjectExportData) {
  const book = createBook(data);
  addRaciSheet(book, data);
  return bytes(book);
}

export function buildCsv(rows: CellValue[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");
}

export function intakeCsvRows(data: ProjectExportData): CellValue[][] {
  return [
    ["Section", "Field", "Value"],
    ["Project", "Client", data.clientName],
    ["Project", "Project", data.project.name],
    ...([
      ["Organization", data.intake.org],
      ["Parent group", data.intake.parent],
      ["Industry", data.intake.industry],
      ["Request type", data.intake.requestType],
      ["Contact name", data.intake.contactName],
      ["Contact email", data.intake.contactEmail],
      ["Objective", data.intake.objective],
      ["Office type", data.intake.officeType],
      ["Work model", data.intake.workModel],
      ["Operating hours", data.intake.hours],
      ["Primary function", data.intake.primaryFn],
      ["Phased occupancy", data.intake.phasedOcc],
      ["Month 1 headcount", data.intake.hc1],
      ["Month 3 headcount", data.intake.hc3],
      ["Month 6 headcount", data.intake.hc6],
      ["Month 12 headcount", data.intake.hc12],
      ["Month 24 headcount", data.intake.hc24],
      ["Density", data.intake.density],
      ["Workspace style", data.intake.workspaceStyle],
      ["Kickoff", data.intake.kickoff],
      ["Go-live", data.intake.golive],
      ["Urgency", data.intake.urgency],
      ["Device type", data.intake.deviceType],
      ["Devices", data.intake.devices],
      [
        "Required spaces",
        data.intake.requiredSpaces?.length
          ? data.intake.requiredSpaces.join(", ")
          : "Not captured",
      ],
    ] as Array<[string, CellValue]>).map(([field, value]) => ["Intake", field, value]),
  ];
}

export function raciCsvRows(data: ProjectExportData): CellValue[][] {
  return [
    [
      "Workstream",
      "Responsible",
      "Responsible email",
      "Accountable",
      "Accountable email",
      "Consulted",
      "Consulted email",
      "Informed",
      "Informed email",
      "Due date",
      "Status",
    ],
    ...data.raci.map((row) => [
      row.workstream,
      row.responsible,
      row.responsible_email,
      row.accountable,
      row.accountable_email,
      row.consulted,
      row.consulted_email,
      row.informed,
      row.informed_email,
      row.due_date,
      human(row.status),
    ]),
  ];
}
