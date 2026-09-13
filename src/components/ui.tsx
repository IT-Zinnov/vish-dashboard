import { signOutAction } from "@/lib/actions";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  title,
  children,
}: {
  profile: Profile | null;
  title: string;
  children: React.ReactNode;
}) {
  const staff = profile?.role === "platform_admin" || profile?.role === "team";
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col bg-navy text-white">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="text-sm font-bold">CoE Hub</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {staff ? "Team workspace" : "Client portal"}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          <a
            className="block rounded-md px-3 py-2 font-medium text-white/75 hover:bg-white/10 hover:text-white"
            href="/dashboard"
          >
            CoE dashboard
          </a>
          {staff ? (
            <a className="block rounded-md bg-brand px-3 py-2 font-medium" href="/master">
              Clients & projects
            </a>
          ) : (
            <a className="block rounded-md bg-brand px-3 py-2 font-medium" href="/portal">
              My projects
            </a>
          )}
        </nav>
        <form action={signOutAction} className="border-t border-white/10 p-3">
          <div className="mb-2 truncate px-1 text-xs text-white/60">
            {profile?.full_name || profile?.email}
          </div>
          <button className="w-full rounded-md px-3 py-2 text-left text-xs text-white/50 hover:bg-white/10 hover:text-white">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-slate-200 bg-white px-6">
          <h1 className="text-sm font-semibold">{title}</h1>
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-600">
            {profile?.role?.replace("_", " ")}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}

export function Card({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-amber-50 text-amber-800",
    submitted: "bg-blue-50 text-blue-800",
    in_review: "bg-indigo-50 text-indigo-800",
    published: "bg-green-50 text-green-800",
    execution: "bg-slate-100 text-slate-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] || "bg-slate-100"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand";
