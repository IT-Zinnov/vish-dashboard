import LoginForm from "./login-form";

export default function LoginPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
            V
          </div>
          <h1 className="text-xl font-bold">CoE Hub</h1>
          <p className="text-sm text-slate-500">Sign in to the workplace planning dashboard</p>
        </div>
        {!configured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Add <code className="font-mono">.env.local</code> with your Supabase URL and anon key
            (copy from <code className="font-mono">.env.example</code>), then restart{" "}
            <code className="font-mono">npm run dev</code>.
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
}
