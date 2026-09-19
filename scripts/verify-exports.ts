// @ts-nocheck -- This executable verification script uses explicit .ts
// extensions so Node's native type stripping can resolve source modules.
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import {
  buildDashboardWorkbook,
  buildIntakeWorkbook,
  buildIntelligenceWorkbook,
  buildRaciWorkbook,
  intakeCsvRows,
  raciCsvRows,
} from "../src/lib/exports/spreadsheets.ts";
import {
  buildDashboardPdf,
  buildIntelligencePdf,
} from "../src/lib/exports/pdf-reports.ts";
import type { ProjectExportData } from "../src/lib/exports/types.ts";

const sample: ProjectExportData = {
  project: {
    id: "demo-project",
    name: "India GCC",
    status: "published",
    is_demo: true,
  },
  clientName: "Fortune 500 E-commerce Company",
  generatedAt: "2026-09-17T12:00:00.000Z",
  recommendationVersion: 1,
  intake: {
    org: "Fortune 500 E-commerce Company",
    parent: "Global E-commerce Group",
    industry: "eCommerce",
    requestType: "New setup",
    contactName: "Demo Programme Sponsor",
    contactEmail: "programme.sponsor@demo.example",
    objective: "Stand up an India GCC for engineering and product operations.",
    officeType: "IT Delivery Center / GCC",
    workModel: "Hybrid",
    hours: "Extended hours",
    primaryFn: "Engineering / R&D",
    phasedOcc: "Yes",
    hc1: 500,
    hc3: 575,
    hc6: 650,
    hc12: 750,
    hc24: 850,
    density: 100,
    workspaceStyle: "Activity-based",
    kickoff: "2026-01",
    golive: "2026-06",
    urgency: "Standard",
    deviceType: "Laptop",
    devices: 525,
    requiredSpaces: [
      "Conference Room / Townhall",
      "Collaboration / Huddle zones",
      "Server / IT room",
    ],
  },
  recommendation: {
    methodologyVersion: "deterministic-v1",
    generatedAt: "2026-09-17T11:00:00.000Z",
    basis: {
      officeType: "IT Delivery Center / GCC",
      headcount: 500,
      month24Headcount: 850,
      density: 100,
    },
    workplace: {
      workstations: 500,
      meetingRooms: 27,
      meetingSeats: 160,
      collaborationSeats: 100,
      cafeSeats: 100,
      dayOneAreaSqft: 50000,
      month24AreaSqft: 85000,
      deskShare: 1,
      utilizationTarget: 65,
      benchmarkAreaRange: [90, 125],
    },
    infrastructure: {
      devices: 525,
      estimatedCablingPorts: 600,
      estimatedCableMetres: 18000,
      estimatedServerRacks: 2,
    },
    schedule: { kickoff: "2026-01", goLive: "2026-06" },
    risks: ["Confirm site capacity before design freeze."],
  },
  raci: [
    {
      workstream: "Real Estate Strategy",
      responsible: "RE Programme Lead",
      responsible_email: "re.lead@demo.example",
      accountable: "Executive Sponsor",
      accountable_email: "sponsor@demo.example",
      consulted: "Design Partner",
      consulted_email: "design@demo.example",
      informed: "Finance",
      informed_email: "finance@demo.example",
      due_date: "2026-10-01",
      status: "completed",
    },
    {
      workstream: "IT Infrastructure",
      responsible: "IT Infrastructure Lead",
      responsible_email: "it.lead@demo.example",
      accountable: "Technology Sponsor",
      accountable_email: "technology@demo.example",
      consulted: "Security",
      consulted_email: "security@demo.example",
      informed: "Facilities",
      informed_email: "facilities@demo.example",
      due_date: "2026-11-01",
      status: "in_progress",
    },
  ],
};

async function verifyWorkbook(
  name: string,
  builder: (data: ProjectExportData) => Promise<Buffer>,
  expectedText: string
) {
  const output = await builder(sample);
  assert(output.length > 6_000, `${name} workbook is unexpectedly small`);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(output);
  assert(book.worksheets.length > 0, `${name} has no worksheets`);
  const values = book.worksheets
    .flatMap((sheet) =>
      sheet.getSheetValues().flatMap((row) =>
        Array.isArray(row) ? row.map((value) => String(value ?? "")) : []
      )
    )
    .join(" ");
  assert(values.includes(expectedText), `${name} is missing ${expectedText}`);
}

async function verifyPdf(
  name: string,
  builder: (data: ProjectExportData) => Promise<Buffer>
) {
  const output = await builder(sample);
  // Vector reports remain compact because charts are drawing primitives rather
  // than raster screenshots.
  assert(output.length > 5_000, `${name} PDF is unexpectedly small`);
  const document = await PDFDocument.load(output);
  assert.equal(document.getPageCount(), 4, `${name} should have four pages`);
}

await verifyWorkbook("Intake", buildIntakeWorkbook, "Fortune 500 E-commerce Company");
await verifyWorkbook("Intelligence", buildIntelligenceWorkbook, "50000");
await verifyWorkbook("Dashboard", buildDashboardWorkbook, "IT Infrastructure");
await verifyWorkbook("RACI", buildRaciWorkbook, "Executive Sponsor");
const intakeRows = intakeCsvRows(sample);
assert(intakeRows.length >= 20, "Intake CSV does not contain all fields");
assert(
  intakeRows.flat().includes("Conference Room / Townhall, Collaboration / Huddle zones, Server / IT room"),
  "Intake export is missing required spaces"
);
const raciRows = raciCsvRows(sample);
assert.equal(raciRows.length, sample.raci.length + 1);
assert(
  raciRows.flat().includes("re.lead@demo.example"),
  "RACI export is missing contact emails"
);
await verifyPdf("Intelligence", buildIntelligencePdf);
await verifyPdf("Dashboard", buildDashboardPdf);

console.log("Verified populated Intake, Intelligence, Dashboard and RACI exports.");
