import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { ProjectExportData } from "@/lib/exports/types";

const PAGE = { width: 595.28, height: 841.89 };
const C = {
  navy: rgb(0.039, 0.086, 0.157),
  blue: rgb(0.071, 0.333, 0.8),
  blue2: rgb(0.102, 0.42, 0.933),
  pale: rgb(0.933, 0.957, 1),
  orange: rgb(0.949, 0.396, 0.133),
  cyan: rgb(0, 0.737, 0.831),
  green: rgb(0.086, 0.639, 0.29),
  red: rgb(0.82, 0.16, 0.16),
  ink: rgb(0.08, 0.12, 0.2),
  muted: rgb(0.39, 0.45, 0.55),
  line: rgb(0.85, 0.89, 0.94),
  white: rgb(1, 1, 1),
  soft: rgb(0.97, 0.98, 0.995),
};

function safe(value: unknown) {
  return String(value ?? "Not provided")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "to")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, "");
}

function number(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-IN").format(value)
    : "Not provided";
}

function human(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

class Report {
  readonly doc: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  readonly pages: PDFPage[] = [];
  readonly data: ProjectExportData;

  private constructor(
    doc: PDFDocument,
    regular: PDFFont,
    bold: PDFFont,
    data: ProjectExportData
  ) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.data = data;
  }

  static async create(data: ProjectExportData) {
    const doc = await PDFDocument.create();
    doc.setTitle(`${data.clientName} - ${data.project.name}`);
    doc.setAuthor("Zinnov Dashboard");
    doc.setSubject("Project intelligence and delivery report");
    doc.setCreationDate(new Date(data.generatedAt));
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new Report(doc, regular, bold, data);
  }

  page(title: string, kicker: string) {
    const page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE.height - 78, width: PAGE.width, height: 78, color: C.navy });
    page.drawText("ZINNOV DASHBOARD", {
      x: 38,
      y: PAGE.height - 29,
      size: 8,
      font: this.bold,
      color: C.cyan,
    });
    page.drawText(safe(kicker).toUpperCase(), {
      x: 38,
      y: PAGE.height - 47,
      size: 7,
      font: this.bold,
      color: rgb(0.65, 0.72, 0.82),
    });
    this.text(page, title, 38, PAGE.height - 68, 18, this.bold, C.white, 510);
    if (this.data.project.is_demo) {
      page.drawRectangle({ x: 462, y: PAGE.height - 34, width: 95, height: 17, color: C.orange });
      page.drawText("DEMONSTRATION", {
        x: 473,
        y: PAGE.height - 29,
        size: 7,
        font: this.bold,
        color: C.white,
      });
    }
    return page;
  }

  text(
    page: PDFPage,
    text: unknown,
    x: number,
    y: number,
    size = 10,
    font = this.regular,
    color = C.ink,
    width = 500,
    lineHeight = size + 3
  ) {
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.forEach((value, index) => {
      page.drawText(value, { x, y: y - index * lineHeight, size, font, color });
    });
    return y - lines.length * lineHeight;
  }

  section(page: PDFPage, title: string, y: number) {
    page.drawRectangle({ x: 38, y: y - 5, width: 4, height: 17, color: C.blue });
    page.drawText(safe(title), { x: 50, y, size: 13, font: this.bold, color: C.navy });
    return y - 25;
  }

  card(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: unknown,
    accent = C.blue
  ) {
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: C.white,
      borderColor: C.line,
      borderWidth: 1,
    });
    page.drawRectangle({ x, y: y - height, width: 4, height, color: accent });
    this.text(page, label.toUpperCase(), x + 14, y - 20, 7, this.bold, C.muted, width - 26);
    this.text(page, value, x + 14, y - 43, 16, this.bold, C.navy, width - 26, 17);
  }

  keyValue(
    page: PDFPage,
    label: string,
    value: unknown,
    x: number,
    y: number,
    width: number
  ) {
    page.drawText(safe(label).toUpperCase(), {
      x,
      y,
      size: 7,
      font: this.bold,
      color: C.muted,
    });
    this.text(page, value, x, y - 15, 10, this.bold, C.ink, width, 12);
  }

  barChart(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    labels: string[],
    values: number[],
    title: string,
    suffix = ""
  ) {
    page.drawRectangle({ x, y: y - height, width, height, color: C.soft, borderColor: C.line, borderWidth: 1 });
    page.drawText(safe(title), { x: x + 15, y: y - 23, size: 10, font: this.bold, color: C.navy });
    const max = Math.max(...values, 1);
    const chartBottom = y - height + 34;
    const chartHeight = height - 72;
    const slot = (width - 46) / values.length;
    values.forEach((value, index) => {
      const barHeight = Math.max(2, (value / max) * chartHeight);
      const barWidth = Math.min(35, slot * 0.55);
      const barX = x + 30 + index * slot + (slot - barWidth) / 2;
      page.drawRectangle({
        x: barX,
        y: chartBottom,
        width: barWidth,
        height: barHeight,
        color: index === values.length - 1 ? C.orange : C.blue,
      });
      const valueText = `${number(value)}${suffix}`;
      page.drawText(valueText, {
        x: barX + barWidth / 2 - this.bold.widthOfTextAtSize(valueText, 7) / 2,
        y: chartBottom + barHeight + 6,
        size: 7,
        font: this.bold,
        color: C.ink,
      });
      const label = safe(labels[index]);
      page.drawText(label, {
        x: barX + barWidth / 2 - this.regular.widthOfTextAtSize(label, 7) / 2,
        y: chartBottom - 14,
        size: 7,
        font: this.regular,
        color: C.muted,
      });
    });
  }

  horizontalBars(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    labels: string[],
    values: number[],
    title: string
  ) {
    page.drawText(safe(title), { x, y, size: 11, font: this.bold, color: C.navy });
    const max = Math.max(...values, 1);
    values.forEach((value, index) => {
      const rowY = y - 28 - index * 38;
      page.drawText(safe(labels[index]), { x, y: rowY + 8, size: 8, font: this.bold, color: C.ink });
      page.drawRectangle({ x: x + 125, y: rowY + 3, width: width - 175, height: 12, color: C.pale });
      page.drawRectangle({
        x: x + 125,
        y: rowY + 3,
        width: Math.max(2, ((width - 175) * value) / max),
        height: 12,
        color: index % 2 ? C.cyan : C.blue,
      });
      page.drawText(number(value), { x: x + width - 40, y: rowY + 6, size: 8, font: this.bold, color: C.navy });
    });
  }

  async save() {
    this.pages.forEach((page, index) => {
      page.drawLine({ start: { x: 38, y: 29 }, end: { x: 557, y: 29 }, color: C.line, thickness: 0.7 });
      page.drawText("Confidential - generated from authorized project data", {
        x: 38,
        y: 16,
        size: 7,
        font: this.regular,
        color: C.muted,
      });
      const pageNumber = `Page ${index + 1} of ${this.pages.length}`;
      page.drawText(pageNumber, {
        x: 557 - this.regular.widthOfTextAtSize(pageNumber, 7),
        y: 16,
        size: 7,
        font: this.regular,
        color: C.muted,
      });
    });
    return Buffer.from(await this.doc.save());
  }
}

function headcount(data: ProjectExportData) {
  return [
    Number(data.intake.hc1) || 0,
    Number(data.intake.hc3) || 0,
    Number(data.intake.hc6) || 0,
    Number(data.intake.hc12) || 0,
    Number(data.intake.hc24) || 0,
  ];
}

function drawProjectContext(report: Report, page: PDFPage, data: ProjectExportData) {
  const y = 725;
  report.keyValue(page, "Client", data.clientName, 38, y, 240);
  report.keyValue(page, "Project", data.project.name, 300, y, 250);
  report.keyValue(page, "Industry", data.intake.industry, 38, y - 48, 240);
  report.keyValue(page, "Office model", data.recommendation.basis?.officeType || data.intake.officeType, 300, y - 48, 250);
  report.keyValue(page, "Business objective", data.intake.objective, 38, y - 96, 512);
}

function drawRisks(report: Report, page: PDFPage, data: ProjectExportData, y: number) {
  const risks = data.recommendation.risks?.length
    ? data.recommendation.risks
    : ["No material risks were identified by the current ruleset."];
  risks.forEach((risk, index) => {
    const itemY = y - index * 55;
    page.drawRectangle({
      x: 38,
      y: itemY - 34,
      width: 519,
      height: 44,
      color: index ? C.soft : rgb(1, 0.965, 0.93),
      borderColor: index ? C.line : C.orange,
      borderWidth: 1,
    });
    page.drawText(String(index + 1), {
      x: 50,
      y: itemY - 14,
      size: 11,
      font: report.bold,
      color: index ? C.blue : C.orange,
    });
    report.text(page, risk, 75, itemY - 9, 9, report.regular, C.ink, 465, 12);
  });
}

export async function buildIntelligencePdf(data: ProjectExportData) {
  const report = await Report.create(data);
  const w = data.recommendation.workplace || {};
  const infra = data.recommendation.infrastructure || {};

  let page = report.page("Zinnov Intelligence Report", "Executive recommendation");
  drawProjectContext(report, page, data);
  report.card(page, 38, 555, 120, 75, "Day-one FTE", number(data.recommendation.basis?.headcount), C.blue);
  report.card(page, 171, 555, 120, 75, "Month-24 FTE", number(data.recommendation.basis?.month24Headcount), C.cyan);
  report.card(page, 304, 555, 120, 75, "Workstations", number(w.workstations), C.orange);
  report.card(page, 437, 555, 120, 75, "Day-one area", `${number(w.dayOneAreaSqft)} sq ft`, C.green);
  report.barChart(page, 38, 445, 519, 275, ["M1", "M3", "M6", "M12", "M24"], headcount(data), "Headcount growth plan", " FTE");
  report.text(
    page,
    `Recommendation version ${data.recommendationVersion || 1}. Methodology: ${data.recommendation.methodologyVersion || "deterministic benchmark model"}.`,
    38,
    142,
    8,
    report.regular,
    C.muted,
    519
  );

  page = report.page("Workplace Configuration", "Space, seats and utilization");
  let y = report.section(page, "Space recommendation", 730);
  report.card(page, 38, y, 158, 75, "Day-one area", `${number(w.dayOneAreaSqft)} sq ft`, C.blue);
  report.card(page, 218, y, 158, 75, "Month-24 area", `${number(w.month24AreaSqft)} sq ft`, C.orange);
  report.card(page, 398, y, 159, 75, "Density", `${number(data.recommendation.basis?.density)} sq ft/FTE`, C.cyan);
  report.barChart(
    page,
    38,
    y - 105,
    250,
    245,
    ["Day 1", "Month 24"],
    [Number(w.dayOneAreaSqft) || 0, Number(w.month24AreaSqft) || 0],
    "Area projection",
    " sq ft"
  );
  report.horizontalBars(
    page,
    320,
    y - 105,
    237,
    ["Workstations", "Meeting seats", "Collaboration", "Cafe seats"],
    [Number(w.workstations) || 0, Number(w.meetingSeats) || 0, Number(w.collaborationSeats) || 0, Number(w.cafeSeats) || 0],
    "Seat allocation"
  );
  y = report.section(page, "Benchmark and operating assumptions", 300);
  report.keyValue(page, "Desk share", `${Math.round((Number(w.deskShare) || 0) * 100)}%`, 38, y, 150);
  report.keyValue(page, "Utilization target", `${number(w.utilizationTarget)}%`, 218, y, 150);
  report.keyValue(page, "Benchmark density", w.benchmarkAreaRange?.length ? `${w.benchmarkAreaRange[0]}-${w.benchmarkAreaRange[1]} sq ft/FTE` : "Not provided", 398, y, 159);
  report.keyValue(page, "Meeting rooms", number(w.meetingRooms), 38, y - 55, 150);
  report.keyValue(page, "Workspace style", data.intake.workspaceStyle, 218, y - 55, 150);
  report.keyValue(page, "Work model", data.intake.workModel, 398, y - 55, 159);

  page = report.page("Technology and Delivery Inputs", "Infrastructure sizing");
  y = report.section(page, "Infrastructure recommendation", 730);
  report.card(page, 38, y, 120, 75, "Devices", number(infra.devices), C.blue);
  report.card(page, 171, y, 120, 75, "Cabling ports", number(infra.estimatedCablingPorts), C.cyan);
  report.card(page, 304, y, 120, 75, "Cable length", `${number(infra.estimatedCableMetres)} m`, C.orange);
  report.card(page, 437, y, 120, 75, "Server racks", number(infra.estimatedServerRacks), C.green);
  y = report.section(page, "Client-provided intake inputs", 555);
  const inputs: Array<[string, unknown]> = [
    ["Request type", data.intake.requestType],
    ["Primary function", data.intake.primaryFn],
    ["Operating hours", data.intake.hours],
    ["Phased occupancy", data.intake.phasedOcc],
    ["Device type", data.intake.deviceType],
    ["Requested devices", data.intake.devices],
    ["Kickoff", data.intake.kickoff],
    ["Target go-live", data.intake.golive],
    ["Urgency", data.intake.urgency],
    ["Contact", data.intake.contactName],
    ["Contact email", data.intake.contactEmail],
    ["Recommendation generated", data.recommendation.generatedAt],
  ];
  inputs.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    report.keyValue(page, label, value, 38 + column * 270, y - row * 55, 245);
  });

  page = report.page("Risks, Schedule and Methodology", "Decision support");
  y = report.section(page, "Risks and attention points", 730);
  drawRisks(report, page, data, y);
  y -= Math.max(1, data.recommendation.risks?.length || 1) * 55 + 20;
  y = report.section(page, "Delivery schedule", y);
  report.keyValue(page, "Kickoff", data.recommendation.schedule?.kickoff || data.intake.kickoff, 38, y, 220);
  report.keyValue(page, "Target go-live", data.recommendation.schedule?.goLive || data.intake.golive, 300, y, 220);
  y = report.section(page, "Methodology and limitations", y - 65);
  report.text(
    page,
    `This recommendation applies Zinnov's ${data.recommendation.methodologyVersion || "deterministic"} benchmark rules to the submitted intake. Area, seat, infrastructure and utilization outputs are planning estimates and should be validated through site due diligence, design development, local code review and commercial discovery.`,
    38,
    y,
    9,
    report.regular,
    C.ink,
    519,
    14
  );
  return report.save();
}

export async function buildDashboardPdf(data: ProjectExportData) {
  const report = await Report.create(data);
  const w = data.recommendation.workplace || {};
  const infra = data.recommendation.infrastructure || {};

  let page = report.page("Project Management Dashboard", "Executive delivery view");
  drawProjectContext(report, page, data);
  report.card(page, 38, 555, 120, 75, "Project stage", human(data.project.status), C.blue);
  report.card(page, 171, 555, 120, 75, "Day-one FTE", number(data.intake.hc1), C.cyan);
  report.card(page, 304, 555, 120, 75, "Day-one area", `${number(w.dayOneAreaSqft)} sq ft`, C.orange);
  const completed = data.raci.filter((row) => row.status === "completed").length;
  const completion = data.raci.length ? Math.round((completed / data.raci.length) * 100) : 0;
  report.card(page, 437, 555, 120, 75, "RACI complete", `${completion}%`, C.green);
  report.barChart(page, 38, 445, 519, 275, ["M1", "M3", "M6", "M12", "M24"], headcount(data), "Headcount delivery trajectory", " FTE");

  page = report.page("Capacity and Workplace Dashboard", "Headcount, space and seat mix");
  report.barChart(
    page,
    38,
    730,
    250,
    270,
    ["Day 1", "Month 24"],
    [Number(w.dayOneAreaSqft) || 0, Number(w.month24AreaSqft) || 0],
    "Area requirement",
    " sq ft"
  );
  report.horizontalBars(
    page,
    320,
    730,
    237,
    ["Workstations", "Meeting seats", "Collaboration", "Cafe seats"],
    [Number(w.workstations) || 0, Number(w.meetingSeats) || 0, Number(w.collaborationSeats) || 0, Number(w.cafeSeats) || 0],
    "Workplace mix"
  );
  let y = report.section(page, "Management KPIs", 400);
  report.card(page, 38, y, 158, 75, "Utilization target", `${number(w.utilizationTarget)}%`, C.blue);
  report.card(page, 218, y, 158, 75, "Desk share", `${Math.round((Number(w.deskShare) || 0) * 100)}%`, C.cyan);
  report.card(page, 398, y, 159, 75, "Meeting rooms", number(w.meetingRooms), C.orange);
  y = report.section(page, "Technology readiness", y - 120);
  report.keyValue(page, "Endpoint devices", number(infra.devices), 38, y, 150);
  report.keyValue(page, "Cabling ports", number(infra.estimatedCablingPorts), 218, y, 150);
  report.keyValue(page, "Server racks", number(infra.estimatedServerRacks), 398, y, 150);

  page = report.page("RACI Delivery Dashboard", "Ownership and workstream status");
  const statuses = ["completed", "in_progress", "assigned"];
  const counts = statuses.map((status) => data.raci.filter((row) => row.status === status).length);
  report.barChart(page, 38, 730, 519, 210, ["Completed", "In progress", "Assigned"], counts, "Workstream status");
  y = report.section(page, "Published assignments", 475);
  const columns = [38, 208, 345, 472];
  ["Workstream", "Responsible", "Accountable", "Status"].forEach((header, index) => {
    page.drawText(header.toUpperCase(), { x: columns[index], y, size: 7, font: report.bold, color: C.muted });
  });
  y -= 20;
  data.raci.slice(0, 10).forEach((row, index) => {
    const rowY = y - index * 43;
    if (index % 2 === 0) page.drawRectangle({ x: 38, y: rowY - 24, width: 519, height: 36, color: C.soft });
    report.text(page, row.workstream, columns[0], rowY, 8, report.bold, C.ink, 155, 10);
    report.text(page, row.responsible || "Unassigned", columns[1], rowY, 8, report.regular, C.ink, 122, 10);
    report.text(page, row.accountable || "Unassigned", columns[2], rowY, 8, report.regular, C.ink, 112, 10);
    report.text(page, human(row.status), columns[3], rowY, 8, report.bold, row.status === "completed" ? C.green : C.blue, 80, 10);
  });

  page = report.page("Milestones, Inputs and Risks", "Management review");
  y = report.section(page, "Milestone timeline", 730);
  page.drawLine({ start: { x: 75, y: y - 35 }, end: { x: 520, y: y - 35 }, color: C.line, thickness: 5 });
  [
    ["Kickoff", data.intake.kickoff, 90],
    ["Intelligence", `v${data.recommendationVersion || 1}`, 250],
    ["RACI published", data.raci.length ? "Published" : "Pending", 395],
    ["Go-live", data.intake.golive, 515],
  ].forEach(([label, value, x], index) => {
    page.drawCircle({ x: Number(x), y: y - 35, size: 7, color: index === 3 ? C.orange : C.blue });
    report.text(page, label, Number(x) - 35, y - 58, 7, report.bold, C.ink, 80, 9);
    report.text(page, value, Number(x) - 35, y - 70, 7, report.regular, C.muted, 80, 9);
  });
  y = report.section(page, "Key intake assumptions", y - 120);
  const inputs: Array<[string, unknown]> = [
    ["Office type", data.intake.officeType],
    ["Work model", data.intake.workModel],
    ["Density", `${number(data.intake.density)} sq ft/FTE`],
    ["Workspace style", data.intake.workspaceStyle],
    ["Operating hours", data.intake.hours],
    ["Primary function", data.intake.primaryFn],
  ];
  inputs.forEach(([label, value], index) => {
    report.keyValue(page, label, value, 38 + (index % 2) * 270, y - Math.floor(index / 2) * 52, 245);
  });
  y = report.section(page, "Risks and attention points", y - 190);
  drawRisks(report, page, data, y);
  return report.save();
}
