import type { IntakePayload } from "@/lib/types";

export type RecommendationOutput = {
  methodologyVersion?: string;
  generatedAt?: string;
  basis?: {
    officeType?: string;
    headcount?: number;
    month24Headcount?: number;
    density?: number;
  };
  workplace?: {
    workstations?: number;
    meetingRooms?: number;
    meetingSeats?: number;
    collaborationSeats?: number;
    cafeSeats?: number;
    dayOneAreaSqft?: number;
    month24AreaSqft?: number;
    deskShare?: number;
    utilizationTarget?: number;
    benchmarkAreaRange?: [number, number];
  };
  infrastructure?: {
    devices?: number;
    estimatedCablingPorts?: number;
    estimatedCableMetres?: number;
    estimatedServerRacks?: number;
  };
  schedule?: {
    kickoff?: string | null;
    goLive?: string | null;
  };
  risks?: string[];
};

export type ExportRaciRow = {
  workstream: string;
  responsible: string | null;
  responsible_email: string | null;
  accountable: string | null;
  accountable_email: string | null;
  consulted: string | null;
  consulted_email: string | null;
  informed: string | null;
  informed_email: string | null;
  due_date: string | null;
  status: string;
};

export type ProjectExportData = {
  project: {
    id: string;
    name: string;
    status: string;
    is_demo?: boolean;
  };
  clientName: string;
  intake: IntakePayload;
  recommendation: RecommendationOutput;
  recommendationVersion?: number;
  raci: ExportRaciRow[];
  generatedAt: string;
};
