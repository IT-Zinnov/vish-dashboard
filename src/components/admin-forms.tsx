"use client";

import { useState } from "react";
import { createProjectAction, createTenantAction, inviteUserAction } from "@/lib/actions";
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
          Invite saved. Ask them to sign up with that exact email — they will be attached to the client automatically.
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
