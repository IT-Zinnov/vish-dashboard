"use client";

import { useState } from "react";
import { advanceProjectAction, reopenIntakeAction, saveRaciAction } from "@/lib/actions";
import { inputClass } from "@/components/ui";

type Row = {
  id: string;
  workstream: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
};

export function TeamActions({ projectId, status }: { projectId: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    const res = await fn();
    if (res.error) setError(res.error);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "draft" && (
        <button className="rounded-lg border px-3 py-1.5 text-xs" onClick={() => run(() => reopenIntakeAction(projectId))}>
          Reopen intake
        </button>
      )}
      {status === "submitted" && (
        <button className="rounded-lg bg-brand px-3 py-1.5 text-xs text-white" onClick={() => run(() => advanceProjectAction(projectId, "in_review"))}>
          Start review
        </button>
      )}
      {(status === "submitted" || status === "in_review") && (
        <button className="rounded-lg bg-navy px-3 py-1.5 text-xs text-white" onClick={() => run(() => advanceProjectAction(projectId, "published"))}>
          Publish to client
        </button>
      )}
      {status === "published" && (
        <button className="rounded-lg bg-navy px-3 py-1.5 text-xs text-white" onClick={() => run(() => advanceProjectAction(projectId, "execution"))}>
          Move to execution
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function RaciEditor({ projectId, rows, canEdit }: { projectId: string; rows: Row[]; canEdit: boolean }) {
  const [local, setLocal] = useState(rows);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, key: keyof Row, value: string) {
    setLocal((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  async function save() {
    setError(null);
    const res = await saveRaciAction(
      projectId,
      local.map((r) => ({
        id: r.id,
        responsible: r.responsible || "",
        accountable: r.accountable || "",
        consulted: r.consulted || "",
        informed: r.informed || "",
      }))
    );
    if (res.error) setError(res.error);
    else setMsg("RACI saved.");
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="pb-2">Workstream</th>
              <th className="pb-2">R</th>
              <th className="pb-2">A</th>
              <th className="pb-2">C</th>
              <th className="pb-2">I</th>
            </tr>
          </thead>
          <tbody>
            {local.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{r.workstream}</td>
                {(["responsible", "accountable", "consulted", "informed"] as const).map((k) => (
                  <td key={k} className="py-2 pr-2">
                    {canEdit ? (
                      <input
                        className={inputClass}
                        value={r[k] || ""}
                        onChange={(e) => patch(r.id, k, e.target.value)}
                      />
                    ) : (
                      r[k] || "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <button className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={save}>
          Save assignments
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
    </div>
  );
}
