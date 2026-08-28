"use client";

import { useState } from "react";
import { saveIntakeAction, submitIntakeAction } from "@/lib/actions";
import { Field, inputClass } from "@/components/ui";
import type { IntakePayload } from "@/lib/types";

const STEPS = ["Business", "Office", "Headcount", "Space", "Timeline", "IT", "Review"];

export function IntakeForm({
  projectId,
  initial,
  locked,
  canSubmit,
}: {
  projectId: string;
  initial: IntakePayload;
  locked: boolean;
  canSubmit: boolean;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<IntakePayload>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof IntakePayload>(key: K, value: IntakePayload[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    const res = await saveIntakeAction(projectId, data);
    setSaving(false);
    if (res.error) setError(res.error);
    else setMsg("Draft saved.");
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await submitIntakeAction(projectId, data);
    setSaving(false);
    if (res.error) setError(res.error);
    else setMsg("Submitted. Your team will assign owners and the next steps.");
  }

  const disabled = locked || !canSubmit;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i + 1)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step === i + 1 ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {step === 1 && (
          <>
            <Field label="Organisation / Entity">
              <input className={inputClass} disabled={disabled} value={data.org || ""} onChange={(e) => set("org", e.target.value)} />
            </Field>
            <Field label="Parent company">
              <input className={inputClass} disabled={disabled} value={data.parent || ""} onChange={(e) => set("parent", e.target.value)} />
            </Field>
            <Field label="Industry">
              <select className={inputClass} disabled={disabled} value={data.industry || ""} onChange={(e) => set("industry", e.target.value)}>
                <option value="">Select</option>
                <option>Technology / SaaS</option>
                <option>BFSI</option>
                <option>eCommerce / Retail</option>
                <option>Manufacturing</option>
                <option>Healthcare / Pharma</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Request type">
              <select className={inputClass} disabled={disabled} value={data.requestType || "New setup"} onChange={(e) => set("requestType", e.target.value)}>
                <option>New setup</option>
                <option>Expansion</option>
                <option>Relocation</option>
              </select>
            </Field>
            <Field label="Primary contact">
              <input className={inputClass} disabled={disabled} value={data.contactName || ""} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="Contact email">
              <input type="email" className={inputClass} disabled={disabled} value={data.contactEmail || ""} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Business objective">
                <textarea
                  className={`${inputClass} min-h-24`}
                  disabled={disabled}
                  value={data.objective || ""}
                  onChange={(e) => set("objective", e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Office type">
              <select className={inputClass} disabled={disabled} value={data.officeType || ""} onChange={(e) => set("officeType", e.target.value)}>
                <option value="">Select</option>
                <option>Global Capability Center (GCC)</option>
                <option>Corporate Office / HQ</option>
                <option>Contact Center / BPO</option>
                <option>Hybrid Collaboration-Led Office</option>
              </select>
            </Field>
            <Field label="Work model">
              <select className={inputClass} disabled={disabled} value={data.workModel || ""} onChange={(e) => set("workModel", e.target.value)}>
                <option value="">Select</option>
                <option>Hybrid (2–3 days)</option>
                <option>Fully in-office (5 days)</option>
                <option>Remote-first / flex</option>
                <option>Shift-based operations</option>
              </select>
            </Field>
            <Field label="Operating hours">
              <select className={inputClass} disabled={disabled} value={data.hours || ""} onChange={(e) => set("hours", e.target.value)}>
                <option value="">Select</option>
                <option>Standard business hours (9–6)</option>
                <option>Extended hours (8–10)</option>
                <option>2 shifts</option>
                <option>3 shifts / 24×7</option>
              </select>
            </Field>
            <Field label="Primary function">
              <select className={inputClass} disabled={disabled} value={data.primaryFn || ""} onChange={(e) => set("primaryFn", e.target.value)}>
                <option value="">Select</option>
                <option>Engineering / R&D</option>
                <option>Product Management</option>
                <option>Data & Analytics</option>
                <option>IT / Infrastructure</option>
                <option>Shared Services / GBS</option>
              </select>
            </Field>
            <Field label="Phased occupancy">
              <select className={inputClass} disabled={disabled} value={data.phasedOcc || "No — Single Move"} onChange={(e) => set("phasedOcc", e.target.value)}>
                <option>No — Single Move</option>
                <option>Yes — Interim / Temp Space</option>
              </select>
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            {(["hc1", "hc3", "hc6", "hc12", "hc24"] as const).map((k, i) => (
              <Field key={k} label={["Day one", "3 months", "6 months", "12 months", "24 months"][i] + " headcount"}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  disabled={disabled}
                  value={data[k] ?? 0}
                  onChange={(e) => set(k, Number(e.target.value))}
                />
              </Field>
            ))}
          </>
        )}
        {step === 4 && (
          <>
            <Field label="Seat density (sq ft / seat)">
              <input
                type="number"
                className={inputClass}
                disabled={disabled}
                value={data.density ?? 80}
                onChange={(e) => set("density", Number(e.target.value))}
              />
            </Field>
            <Field label="Workspace style">
              <select className={inputClass} disabled={disabled} value={data.workspaceStyle || ""} onChange={(e) => set("workspaceStyle", e.target.value)}>
                <option value="">Select</option>
                <option>Open plan</option>
                <option>Activity-based</option>
                <option>Assigned desks</option>
              </select>
            </Field>
            <p className="sm:col-span-2 text-sm text-slate-500">
              Estimated day-one area:{" "}
              <b>{(((data.hc1 || 0) * (data.density || 80)).toLocaleString("en-IN"))} sq ft</b>
            </p>
          </>
        )}
        {step === 5 && (
          <>
            <Field label="Kick-off date">
              <input type="month" className={inputClass} disabled={disabled} value={data.kickoff || ""} onChange={(e) => set("kickoff", e.target.value)} />
            </Field>
            <Field label="Target go-live">
              <input type="month" className={inputClass} disabled={disabled} value={data.golive || ""} onChange={(e) => set("golive", e.target.value)} />
            </Field>
            <Field label="Urgency">
              <select className={inputClass} disabled={disabled} value={data.urgency || ""} onChange={(e) => set("urgency", e.target.value)}>
                <option value="">Select</option>
                <option>Standard</option>
                <option>Aggressive</option>
                <option>Flexible</option>
              </select>
            </Field>
          </>
        )}
        {step === 6 && (
          <>
            <Field label="Primary device type">
              <select className={inputClass} disabled={disabled} value={data.deviceType || ""} onChange={(e) => set("deviceType", e.target.value)}>
                <option value="">Select</option>
                <option>Laptop</option>
                <option>Desktop</option>
                <option>Mix</option>
              </select>
            </Field>
            <Field label="Devices — day one">
              <input
                type="number"
                className={inputClass}
                disabled={disabled}
                value={data.devices ?? data.hc1 ?? 0}
                onChange={(e) => set("devices", Number(e.target.value))}
              />
            </Field>
          </>
        )}
        {step === 7 && (
          <div className="sm:col-span-2 space-y-2 text-sm">
            <p><b>Org:</b> {data.org || "—"} · <b>Office:</b> {data.officeType || "—"}</p>
            <p><b>Day-one HC:</b> {data.hc1 || 0} · <b>12 mo:</b> {data.hc12 || 0}</p>
            <p><b>Go-live:</b> {data.golive || "—"} · <b>Devices:</b> {data.devices ?? data.hc1 ?? 0}</p>
            {locked && <p className="rounded-lg bg-blue-50 p-3 text-blue-800">Intake is locked. Your team owns assignment and next steps.</p>}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 1 && (
          <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setStep(step - 1)}>
            Previous
          </button>
        )}
        {step < 7 && (
          <button type="button" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={() => setStep(step + 1)}>
            Next
          </button>
        )}
        {!locked && canSubmit && (
          <>
            <button type="button" disabled={saving} className="rounded-lg border px-4 py-2 text-sm" onClick={saveDraft}>
              Save draft
            </button>
            {step === 7 && (
              <button type="button" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white" onClick={submit}>
                Submit to team
              </button>
            )}
          </>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
        {msg && <span className="text-sm text-green-700">{msg}</span>}
      </div>
    </div>
  );
}
