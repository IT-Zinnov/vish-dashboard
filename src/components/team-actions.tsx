"use client";

import { useState } from "react";
import {
  advanceProjectAction,
  approveRecommendationAction,
  publishRaciAction,
  reopenIntakeAction,
  saveRaciAction,
} from "@/lib/actions";
import { inputClass } from "@/components/ui";

type Row = {
  id: string;
  workstream: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  due_date?: string | null;
  status?: string | null;
};

export function TeamActions({
  projectId,
  status,
  canPublish,
  recommendationStatus,
}: {
  projectId: string;
  status: string;
  canPublish: boolean;
  recommendationStatus?: string | null;
}) {
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
      {recommendationStatus === "ready" && (
        <button
          className="rounded-lg bg-brand px-3 py-1.5 text-xs text-white"
          onClick={() => run(() => approveRecommendationAction(projectId))}
        >
          Approve Intelligence &amp; proceed to RACI
        </button>
      )}
      {(status === "submitted" || status === "in_review") &&
        canPublish &&
        recommendationStatus === "approved" && (
        <button className="rounded-lg bg-navy px-3 py-1.5 text-xs text-white" onClick={() => run(() => publishRaciAction(projectId))}>
          Publish RACI &amp; plan
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
        dueDate: r.due_date || "",
        status: r.status || "unassigned",
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
              <th className="pb-2">Due date</th>
              <th className="pb-2">Status</th>
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
                <td className="py-2 pr-2">
                  {canEdit ? (
                    <input
                      type="date"
                      className={inputClass}
                      value={r.due_date || ""}
                      onChange={(e) => patch(r.id, "due_date", e.target.value)}
                    />
                  ) : (
                    r.due_date || "—"
                  )}
                </td>
                <td className="py-2 pr-2">
                  {canEdit ? (
                    <select
                      className={inputClass}
                      value={r.status || "unassigned"}
                      onChange={(e) => patch(r.id, "status", e.target.value)}
                    >
                      <option value="unassigned">Unassigned</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    (r.status || "unassigned").replace("_", " ")
                  )}
                </td>
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
