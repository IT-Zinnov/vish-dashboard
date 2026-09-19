export type AppRole =
  | "platform_admin"
  | "team"
  | "client_contributor"
  | "client_viewer";

export type ProjectStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "published"
  | "execution";

export type Profile = {
  id: string;
  tenant_id: string | null;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  access_revoked_at?: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  is_demo?: boolean;
};

export type Project = {
  id: string;
  tenant_id: string;
  name: string;
  status: ProjectStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  published_at: string | null;
  created_at: string;
  is_demo?: boolean;
};

export type IntakePayload = {
  org?: string;
  parent?: string;
  industry?: string;
  requestType?: string;
  contactName?: string;
  contactEmail?: string;
  objective?: string;
  officeType?: string;
  workModel?: string;
  hours?: string;
  primaryFn?: string;
  phasedOcc?: string;
  hc1?: number;
  hc3?: number;
  hc6?: number;
  hc12?: number;
  hc24?: number;
  density?: number;
  workspaceStyle?: string;
  kickoff?: string;
  golive?: string;
  urgency?: string;
  deviceType?: string;
  devices?: number;
  requiredSpaces?: string[];
};

export const REQUIRED_SPACES = [
  "Conference Room / Townhall",
  "Focus / Quiet pods",
  "Collaboration / Huddle zones",
  "Training / Classroom",
  "Cafeteria / Pantry",
  "Reception / Lobby",
  "Server / IT room",
  "Gym",
  "Research Lab",
  "Prayer / Spiritual room",
  "Wellness / Mother's room",
] as const;

export const DEFAULT_RACI = [
  { workstream: "Real Estate Strategy", responsible: "", accountable: "Director", consulted: "Design Team", informed: "Finance" },
  { workstream: "Design & Build", responsible: "", accountable: "Director", consulted: "Vendors", informed: "IT Team" },
  { workstream: "IT Infrastructure", responsible: "", accountable: "Director", consulted: "Security", informed: "FM Team" },
  { workstream: "Facilities Management", responsible: "", accountable: "Director", consulted: "RE Lead", informed: "Client" },
  { workstream: "Change & Communications", responsible: "", accountable: "PM", consulted: "HR", informed: "All staff" },
];

export function homeForRole(role: AppRole | undefined) {
  if (role === "platform_admin" || role === "team") return "/master";
  return "/portal";
}

export function isStaff(role: AppRole | undefined) {
  return role === "platform_admin" || role === "team";
}

export function canEditIntake(role: AppRole | undefined, status: ProjectStatus) {
  if (status !== "draft") return false;
  return role === "client_contributor" || isStaff(role);
}

export function canAssignWork(role: AppRole | undefined) {
  return isStaff(role);
}
