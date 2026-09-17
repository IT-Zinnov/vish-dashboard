"use client";

import { useState } from "react";
import {
  deleteProjectAction,
  deleteTenantAction,
  revokeUserAccessAction,
} from "@/lib/actions";

function DangerButton({
  label,
  confirmation,
  run,
}: {
  label: string;
  confirmation: string;
  run: () => Promise<{ error?: string; redirectTo?: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        onClick={async () => {
          if (!window.confirm(confirmation)) return;
          setPending(true);
          setError(null);
          const result = await run();
          if (result.error) {
            setError(result.error);
            setPending(false);
            return;
          }
          if (result.redirectTo) window.location.href = result.redirectTo;
          else window.location.reload();
        }}
      >
        {pending ? "Working…" : label}
      </button>
      {error && <p className="mt-1 max-w-sm text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  return (
    <DangerButton
      label="Delete project"
      confirmation={`Permanently delete “${projectName}”? Its intake, Intelligence, RACI, activity and export files will be removed. This cannot be undone.`}
      run={() => deleteProjectAction(projectId)}
    />
  );
}

export function DeleteTenantButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  return (
    <DangerButton
      label="Delete client"
      confirmation={`Permanently delete client “${tenantName}” and every project under it? Client-user access will also be revoked. This cannot be undone.`}
      run={() => deleteTenantAction(tenantId)}
    />
  );
}

export function RevokeAccessButton({
  profileId,
  email,
}: {
  profileId: string;
  email: string;
}) {
  return (
    <DangerButton
      label="Remove access"
      confirmation={`Remove application access for ${email}? They will be signed out on their next request and cannot use the dashboard until reassigned by the platform admin.`}
      run={() => revokeUserAccessAction(profileId)}
    />
  );
}

