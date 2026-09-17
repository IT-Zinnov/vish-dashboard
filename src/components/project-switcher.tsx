"use client";

import { useRouter } from "next/navigation";

export type SwitcherProject = {
  id: string;
  label: string;
  isDemo: boolean;
};

export function ProjectSwitcher({
  projects,
  activeId,
  view,
}: {
  projects: SwitcherProject[];
  activeId?: string;
  view?: string;
}) {
  const router = useRouter();
  if (!projects.length) return null;

  const real = projects.filter((item) => !item.isDemo);
  const demo = projects.filter((item) => item.isDemo);

  return (
    <label className="flex min-w-0 items-center gap-2 text-[11px] text-white/55">
      <span className="hidden sm:inline">Viewing</span>
      <select
        value={activeId || ""}
        onChange={(event) => {
          const next = new URLSearchParams({ project: event.target.value });
          if (view) next.set("view", view);
          router.push(`/dashboard?${next.toString()}`);
        }}
        className="max-w-[18rem] truncate rounded-md border border-white/20 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-900 outline-none focus:border-brand"
      >
        {!activeId && <option value="">Select a project</option>}
        {real.length > 0 && (
          <optgroup label="Clients">
            {real.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </optgroup>
        )}
        {demo.length > 0 && (
          <optgroup label="Demo clients">
            {demo.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
