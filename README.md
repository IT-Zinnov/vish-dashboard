# Vish Dashboard

Multi-tenant GCC / workplace planning hub.

**Stack:** Next.js 15 + Vercel + Supabase (free)

## What this version does

- First person to sign up becomes **platform admin (you)**
- You onboard **clients (tenants)**, create **projects**, and **invite users by email**
- Client **contributors** fill and submit intake; the form **locks** after submit
- Your **team** assigns RACI / next steps and **publishes** so the client can view it
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
```

4. In Supabase: SQL Editor → paste and run `supabase/migrations/001_init.sql`
5. Auth → Providers → Email: you can turn **off** “Confirm email” while testing locally

## 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Sign up with **your** email first (you become master). Then onboard a client, invite a second email as Client contributor, create a project.

## GitHub

Remote: https://github.com/Vaishnavimore10/vish-dashboard
