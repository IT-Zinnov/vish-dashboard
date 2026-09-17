# Zinnov Dashboard

Multi-tenant GCC / workplace planning hub.

**Stack:** Next.js 15 + Vercel + Supabase (free)

## What this version does

- First person to sign up becomes **platform admin (you)**
- You onboard **clients (tenants)**, create **projects**, and **invite users by email**
- Client **contributors** submit intake and immediately receive generated Zinnov Intelligence and metrics
- Your **team** assigns RACI; the platform admin publishes it separately for client viewing
- Core Intake, Intelligence, Dashboard and RACI exports are stored privately in Supabase Storage
- Platform admins can revoke user access and permanently delete projects or clients
- Client **viewers** cannot edit the form

The original HTML prototype is in `prototype/`.

## 1. Install

```bash
npm install
```

## 2. Create a free Supabase project

1. Open [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public** key from Settings → API
3. Create `.env.local` in this folder:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=server-only-secret
```

Find the service-role key in Supabase → Project Settings → API. It bypasses
RLS and must only be added to `.env.local` and Vercel server environment
variables. Never give it a `NEXT_PUBLIC_` prefix.

4. In Supabase SQL Editor, run in order:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/003_ensure_profile.sql`
   - `supabase/migrations/004_backend_foundation.sql`
   - `supabase/migrations/005_apply_invites_to_existing_users.sql`
   - `supabase/migrations/006_workflow_exports.sql`
   - `supabase/migrations/007_admin_lifecycle.sql`
   - `supabase/migrations/008_cleanup_demo_and_deleted_accounts.sql`
   - `supabase/migrations/009_demo_clients.sql` — seeds the two permanent demo
     clients. Re-run it any time to restore them after edits or deletion.
5. Auth → Providers → Email: you can turn **off** “Confirm email” while testing locally

Office networks that intercept HTTPS: local `npm run dev` uses Node `--use-system-ca`. Vercel does not need that flag.

## 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Sign up with **your** email first (you become master). Then onboard a client, invite a second email as Client contributor, create a project.

## 4. Deploy on Vercel (Hobby / free)

1. Push this repo to GitHub
2. In [vercel.com](https://vercel.com) → Add New → Project → import the repo
3. Framework: Next.js (auto-detected)
4. Environment variables (same values as `.env.local`, never commit that file):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` and/or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy. After you have the `*.vercel.app` URL, in Supabase → Authentication → URL Configuration set **Site URL** to that origin and add it under **Redirect URLs**.

## GitHub

Remote: https://github.com/IT-Zinnov/vish-dashboard
