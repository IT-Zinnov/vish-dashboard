"use client";

import { useState } from "react";
import {
  assignUserAction,
  createProjectAction,
  createTenantAction,
  inviteUserAction,
} from "@/lib/actions";
import { Field, inputClass } from "@/components/ui";
import type { Tenant } from "@/lib/types";

export function CreateTenantForm() {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex gap-2"
      action={async (fd) => {
        setError(null);
        const res = await createTenantAction(fd);
        if (res && "error" in res && res.error) setError(res.error);
      }}
    >
      <input name="name" className={inputClass} placeholder="Client company name" required />
      <button className="whitespace-nowrap rounded-lg bg-brand px-4 text-sm font-semibold text-white">
        Onboard
      </button>
      {error && <p className="self-center text-xs text-red-600">{error}</p>}
    </form>
  );
}

export function InviteForm({ tenants }: { tenants: Tenant[] }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      action={async (fd) => {
        setError(null);
        setOk(false);
        const res = await inviteUserAction(fd);
        if (res && "error" in res && res.error) setError(res.error);
        else setOk(true);
      }}
    >
      <Field label="Email">
        <input name="email" type="email" className={inputClass} required />
      </Field>
      <Field label="Role">
        <select name="role" className={inputClass} defaultValue="client_contributor">
          <option value="client_contributor">Client — fill intake</option>
          <option value="client_viewer">Client — view only</option>
          <option value="team">Internal team</option>
        </select>
      </Field>
      <Field label="Client company">
        <select name="tenant_id" className={inputClass}>
          <option value="">— not a client user —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <button className="h-[38px] rounded-lg bg-navy px-4 text-sm font-semibold text-white">Invite</button>
      </div>
      {error && <p className="sm:col-span-4 text-xs text-red-600">{error}</p>}
      {ok && (
        <p className="sm:col-span-4 text-xs text-green-700">
          Invitation email sent. The recipient can open the secure link, set a
          password, and enter the assigned client dashboard directly.
        </p>
      )}
    </form>
  );
}

/**
 * Attach a user who has *already signed up*. InviteForm only works for people
 * who have not created an account yet, which is the trap that left a signed-up
 * user stuck on "No client assigned".
 */
export function AssignUserForm({ tenants }: { tenants: Tenant[] }) {
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      action={async (fd) => {
        setError(null);
        setOutcome(null);
        const res = await assignUserAction(fd);
        if (res && "error" in res && res.error) setError(res.error);
        else if (res && "outcome" in res) setOutcome(res.outcome ?? "done");
      }}
    >
      <Field label="Existing user email">
        <input name="email" type="email" className={inputClass} required />
      </Field>
      <Field label="Role">
        <select name="role" className={inputClass} defaultValue="client_contributor">
          <option value="client_contributor">Client — fill intake</option>
          <option value="client_viewer">Client — view only</option>
          <option value="team">Internal team</option>
        </select>
      </Field>
      <Field label="Client company">
        <select name="tenant_id" className={inputClass}>
          <option value="">— not a client user —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <button className="h-[38px] rounded-lg bg-brand px-4 text-sm font-semibold text-white">
          Attach now
        </button>
      </div>
      {error && <p className="text-xs text-red-600 sm:col-span-4">{error}</p>}
      {outcome === "profile_updated" && (
        <p className="text-xs text-green-700 sm:col-span-4">
          Attached. They should reload the app — no new signup needed.
        </p>
      )}
      {outcome === "invite_created" && (
        <p className="text-xs text-amber-700 sm:col-span-4">
          No account with that email yet. Saved as a pending invite — it applies
          when they sign up or next sign in.
        </p>
      )}
    </form>
  );
}

export function CreateProjectForm({ tenantId }: { tenantId: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex gap-2"
      action={async (fd) => {
        setError(null);
        fd.set("tenant_id", tenantId);
        const res = await createProjectAction(fd);
        if (res && "error" in res && res.error) setError(res.error);
      }}
    >
      <input name="name" className={inputClass} placeholder="Project name, e.g. Bangalore GCC" required />
      <button className="whitespace-nowrap rounded-lg bg-brand px-4 text-sm font-semibold text-white">
        Create project
      </button>
      {error && <p className="self-center text-xs text-red-600">{error}</p>}
    </form>
  );
}
