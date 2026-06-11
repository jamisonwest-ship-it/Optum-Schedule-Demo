# OptumRx Scheduling Platform

A web platform that replaces three disconnected pharmacy systems — Lucy's Excel
pre-schedule, Jeremy's manual ratio spreadsheet, and When I Work — for two
Optum pharmacy locations: **SMRX** (active) and **SMMS** (opening July 1, 2026).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(PostgreSQL + magic-link auth) · Resend (email) · Vercel

## What it does

| Feature | Where | Who |
|---|---|---|
| **Ratio dashboard** — 28 half-hour slots, color-coded, three grids (SMRX main / SPC isolated / SMMS) | `/ratio` | Managers + pharmacists |
| **Live status** — Working / Lunch / Meeting / Out / Non-Tech, recalculates ratio instantly | `/ratio` + `/my-schedule` | Everyone |
| **Staff portal** — mobile-first: today's shift, one-tap status, week view, time-off + callout submission | `/my-schedule` | All staff (replaces When I Work) |
| **Pre-scheduling** — monthly staff × days grid, draft → publish workflow, PTO overlay, 40-hr overtime flags | `/schedule` | Lucy + tech supervisors |
| **Request queue** — one-click approve/deny, emails the requester | `/requests` | Managers |
| **Setup** — roster, configurable work types (all ratio rules live in data), locations | `/setup` | Admin |

All ratio counting rules (which work types count, the IV before-8:30 exclusion,
per-person always-exclude flags, SPC isolation) live in database tables — not
code. The activity log is append-only.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev                         # http://localhost:3102
```

## First-time setup (in order)

1. **Database** — Supabase Dashboard → SQL Editor, run in order:
   1. `supabase/migrations/001_schema.sql` (tables + RLS)
   2. `supabase/migrations/002_seed.sql` (45 staff, work types, June demo week)
2. **Vercel env vars** — Settings → Environment Variables, all environments:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `NEXT_PUBLIC_APP_URL`
3. **Supabase Auth URLs** — Authentication → URL Configuration:
   - Site URL: your production URL
   - Redirect URLs: add `http://localhost:3102/**` and `https://<your-app>.vercel.app/**`
4. **(Recommended) Resend SMTP for login emails** — Supabase's built-in email
   sender is limited to ~2 emails/hour, which will break a live demo.
   Authentication → SMTP Settings → enable custom SMTP:
   host `smtp.resend.com`, port `465`, user `resend`, password = the
   `RESEND_API_KEY`, sender `schedule@jamisonwest.ai`.

## Logging in

Magic-link only (no passwords). The email must match a row in `staff`.
Seeded logins that work out of the box: `jamison.west@outlook.com` (admin),
`dr.monahan@yahoo.com` (Susie, admin), `lucy.kim@optum.com` (scheduler).
Staff rows with `@example.com` placeholder emails can't log in until their
real address is set in `/setup`.

## Notes

- `_legacy_demo.html` is the original single-file demo — reference only.
- `Older Excel Attempt/` is prior source material (gitignored).
- Email accounts: this project sends via the **jamisonwest.ai** Resend account
  (`jamison.west@outlook.com`) — never the thewest.casa account.
- Keep API routes ≤ 10 (Vercel Hobby function limit); currently 8.
