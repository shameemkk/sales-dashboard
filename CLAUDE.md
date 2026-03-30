# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build (static standalone output)
- `npm run lint` — run ESLint (`eslint` with no args, uses flat config)
- No test framework is configured

## Architecture

Next.js 16 App Router project (TypeScript, Tailwind v4) for Uparrowagency's internal sales dashboard. Uses shadcn/ui components and Supabase for auth + data storage.

### Data flow

- **External APIs**: Two upstream services are consumed server-side:
  - `send.uparrowagency.com/api` (Instantly-style email campaigns) — uses `SEND_API_TOKEN`
  - `services.leadconnectorhq.com` (GoHighLevel / LeadConnector) — uses `LCH_API_TOKEN`
- **Sync layer** (`src/lib/sync.ts`, `src/lib/performance-sync.ts`): API routes pull stats from external APIs and upsert into Supabase tables (`account_daily_stats`, `daily_performance`)
- **Supabase clients**: three variants for different contexts:
  - `src/lib/supabase.ts` — browser client (`createBrowserClient`)
  - `src/lib/supabase-server.ts` — server actions/middleware (`createServerClient` with cookies)
  - `src/lib/supabase-bg.ts` — background/API route use (service-role key, no cookie context)
- **Client components** fetch data via internal API routes (`/api/accounts`, `/api/account-stats`, `/api/performance-sync`, etc.)

### UI structure

- `src/app/layout.tsx` — root layout wraps everything in `ThemeProvider` > `TooltipProvider` > `SidebarProvider`
- `src/app/page.tsx` — renders `DashboardTabsClient`
- `src/components/dashboard-tabs.tsx` — main shell: shadcn Sidebar + four sections (Daily Performance, Performance Table, Account Overview, Settings)
- `src/lib/data.ts` — shared TypeScript interfaces (`DailyPerformance`, `EmailAccount`, `AccountDailyStat`, `SyncJob`)
- `src/lib/settings.ts` — localStorage-based user preferences (default columns, date range)
- `src/app/login/` — Supabase email/password auth flow via server actions (`src/app/actions.ts`)

### API routes

All under `src/app/api/`:
- `accounts/` — list email sender accounts
- `account-stats/` — per-account daily stats
- `account-sync/` — trigger/status/retry/history for account stat sync jobs
- `performance-sync/` — sync daily performance aggregates
- `sender-emails/` — sender email list
- `tags/` — account tags
- `warmup/[id]/` — toggle warmup for a sender

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Environment variables

See `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SEND_API_TOKEN`, `LCH_API_TOKEN`, `SYNC_SECRET`, `DEBUG`
