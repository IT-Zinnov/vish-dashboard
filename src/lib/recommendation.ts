import type { IntakePayload } from "@/lib/types";

type OfficeBenchmark = {
  label: string;
  deskShare: number;
  meetingSeatRatio: number;
  collaborationSeatRatio: number;
  cafeSeatRatio: number;
  utilization: number;
  areaRange: [number, number];
};

const OFFICE_BENCHMARKS: Record<string, OfficeBenchmark> = {
  GCC: {
    label: "IT Delivery Center / GCC",
    deskShare: 1,
    meetingSeatRatio: 0.32,
    collaborationSeatRatio: 0.2,
    cafeSeatRatio: 0.2,
    utilization: 65,
    areaRange: [90, 125],
  },
  HQ: {
    label: "Corporate Office / HQ",
    deskShare: 0.85,
    meetingSeatRatio: 0.25,
    collaborationSeatRatio: 0.125,
    cafeSeatRatio: 0.16,
    utilization: 67,
    areaRange: [125, 200],
  },
  BPO: {
    label: "Contact Center / BPO",
    deskShare: 1,
    meetingSeatRatio: 0.11,
    collaborationSeatRatio: 0.065,
    cafeSeatRatio: 0.1,
    utilization: 88,
    areaRange: [55, 80],
  },
  Hybrid: {
    label: "Hybrid Collaboration-Led",
    deskShare: 0.6,
    meetingSeatRatio: 0.42,
    collaborationSeatRatio: 0.275,
    cafeSeatRatio: 0.25,
    utilization: 57,
    areaRange: [140, 220],
  },
  Density: {
    label: "Density-Optimized Operations",
    deskShare: 1,
    meetingSeatRatio: 0.12,
    collaborationSeatRatio: 0.065,
    cafeSeatRatio: 0.075,
    utilization: 92,
    areaRange: [50, 75],
  },
};

function benchmarkFor(value?: string) {
  const input = (value || "").toLowerCase();
  if (input.includes("bpo") || input.includes("contact")) return OFFICE_BENCHMARKS.BPO;
  if (input.includes("density")) return OFFICE_BENCHMARKS.Density;
  if (input.includes("hybrid") || input.includes("collaboration")) return OFFICE_BENCHMARKS.Hybrid;
  if (input.includes("hq") || input.includes("corporate")) return OFFICE_BENCHMARKS.HQ;
  return OFFICE_BENCHMARKS.GCC;
}

export function generateRecommendation(payload: IntakePayload) {
  const benchmark = benchmarkFor(payload.officeType);
  const headcount = Math.max(0, Number(payload.hc1) || 0);
  const month24Headcount = Math.max(headcount, Number(payload.hc24) || headcount);
  const density = Math.max(1, Number(payload.density) || 100);
  const workstations = Math.round(headcount * benchmark.deskShare);
  const meetingSeats = Math.round(workstations * benchmark.meetingSeatRatio);
  const collaborationSeats = Math.round(
    workstations * benchmark.collaborationSeatRatio
  );
  const cafeSeats = Math.round(workstations * benchmark.cafeSeatRatio);
  const ports = Math.round((headcount / 300) * 360);
  const racks = Math.max(1, Math.ceil(headcount / 250));

  return {
    methodologyVersion: "deterministic-v1",
    generatedAt: new Date().toISOString(),
    basis: {
      officeType: benchmark.label,
      headcount,
      month24Headcount,
      density,
    },
    workplace: {
      workstations,
      meetingRooms: Math.max(1, Math.round(meetingSeats / 6)),
      meetingSeats,
      collaborationSeats,
      cafeSeats,
      dayOneAreaSqft: headcount * density,
      month24AreaSqft: month24Headcount * density,
      deskShare: benchmark.deskShare,
      utilizationTarget: benchmark.utilization,
      benchmarkAreaRange: benchmark.areaRange,
    },
    infrastructure: {
      devices: Number(payload.devices) || headcount,
      estimatedCablingPorts: ports,
      estimatedCableMetres: ports * 30,
      estimatedServerRacks: racks,
    },
    schedule: {
      kickoff: payload.kickoff || null,
      goLive: payload.golive || null,
    },
    risks: [
      ...(density < benchmark.areaRange[0]
        ? ["Selected density is tighter than the benchmark range."]
        : []),
      ...(density > benchmark.areaRange[1]
        ? ["Selected density is above the benchmark range and may increase cost."]
        : []),
      ...(!payload.kickoff || !payload.golive
        ? ["Kickoff and go-live dates must be confirmed."]
        : []),
    ],
  };
}
