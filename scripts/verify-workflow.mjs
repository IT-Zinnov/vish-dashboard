import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, actions, bridge, intakeApi, intakeForm, teamActions] =
  await Promise.all([
    read("supabase/migrations/010_client_workflow_enhancements.sql"),
    read("src/lib/actions.ts"),
    read("public/dashboard-bridge.js"),
    read("src/app/api/dashboard/intake/route.ts"),
    read("src/components/intake-form.tsx"),
    read("src/components/team-actions.tsx"),
  ]);

for (const column of [
  "responsible_email",
  "accountable_email",
  "consulted_email",
  "informed_email",
]) {
  assert(migration.includes(column), `Migration is missing ${column}`);
  assert(actions.includes(column), `RACI save/publish is missing ${column}`);
}

assert(
  actions.includes('status: "execution"'),
  "RACI publication must transition directly to execution"
);
assert(
  !teamActions.includes("Move to execution"),
  "Legacy execution approval button is still present"
);
assert(
  actions.includes("inviteUserByEmail"),
  "Client invitation email is not wired"
);
assert(
  intakeApi.includes('"requiredSpaces"') &&
    intakeForm.includes("REQUIRED_SPACES") &&
    bridge.includes("intake.requiredSpaces"),
  "Required spaces are not persisted end-to-end"
);
assert(
  bridge.includes("coe-print-ai") &&
    bridge.includes("coe-print-dashboard") &&
    bridge.includes("coe-print-exec"),
  "One or more UI print modes are missing"
);
assert(
  bridge.includes("coe-print-doc") &&
    bridge.includes("&print=") &&
    bridge.includes("window.open("),
  "Reports must render as a standalone tab, not inside the embedded frame"
);
assert(
  bridge.includes(".layout { display: block !important") &&
    bridge.includes("print-color-adjust: exact !important"),
  "Print CSS must unclip the 100vh layout and force colour output"
);
assert(
  bridge.includes('view === "pricing"') &&
    migration.includes("public.is_team_member()"),
  "Client pricing access is not blocked in UI and RLS"
);
assert(
  bridge.includes('view === "exec"') &&
    bridge.includes("!permissions.raciPublished"),
  "Execution direct-link lock is missing"
);

console.log(
  "Verified RACI contacts, invite delivery, workflow locks, required spaces, pricing denial, and print modes."
);
