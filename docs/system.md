# System Architecture Documentation

## Overview

Uparrow Agency internal sales dashboard built with Next.js 16 (App Router, TypeScript, Tailwind v4). Tracks email campaign performance, sender accounts, leads, and automated sync schedules.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Database | Supabase (PostgreSQL + Auth) |
| Scheduling | node-cron (in-process) |

---

## External Services

### Instantly (Email Campaigns)
- **Base URL:** `send.uparrowagency.com/api`
- **Auth:** `SEND_API_TOKEN` header
- **Data:** Sender accounts, campaign stats, warmup data, tags

### GoHighLevel / LeadConnector
- **Base URL:** `services.leadconnectorhq.com`
- **Auth:** `LCH_API_TOKEN` header
- **Data:** Contacts (leads), conversations (for enrichment)

---

## Database Schema

### Tables

#### `daily_performance`
One row per date. Stores aggregated daily email and meeting metrics.

| Column | Type | Description |
|---|---|---|
| `date` | date (PK) | The date |
| `total_emails_sent` | integer | Total emails sent |
| `total_new_leads_contacted` | integer | New leads contacted |
| `total_replies` | integer | Total replies received |
| `total_positive_replies` | integer | Positive replies |
| `today_appointments` | integer | Appointments booked |
| `meetings_no_show` | integer | No-show meetings |
| `meetings_show_up` | integer | Show-up meetings |
| `meetings_disqualified` | integer | Disqualified meetings |
| `meetings_canceled` | integer | Canceled meetings |
| `meetings_rescheduled` | integer | Rescheduled meetings |
| `meetings_closed` | integer | Closed meetings |
| `bookings` | integer | Total bookings |

#### `sender_accounts`
Cached email sender accounts from Instantly API.

| Column | Type | Description |
|---|---|---|
| `id` | bigint (PK) | API account ID |
| `name` | text | Account name |
| `email` | text | Email address |
| `daily_limit` | integer | Daily send limit |
| `type` | text | Account type |
| `status` | text | Connection status |
| `warmup_enabled` | boolean | Warmup on/off |
| `tags` | jsonb | Tags array from API |
| `synced_at` | timestamptz | Last sync timestamp |

#### `account_daily_stats`
Per-account daily campaign statistics.

| Column | Type | Description |
|---|---|---|
| `id` | bigserial (PK) | Auto-increment ID |
| `sender_id` | bigint (FK) | References `sender_accounts.id` |
| `stat_date` | date | Date of stats |
| `sent` | integer | Emails sent |
| `replied` | integer | Replies received |
| `total_opens` | integer | Total opens |
| `unique_opens` | integer | Unique opens |
| `unsubscribed` | integer | Unsubscribes |
| `bounced` | integer | Bounces |
| `interested` | integer | Interested replies |

#### `sync_jobs`
Legacy sync job tracker for account stat syncs.

| Column | Type | Description |
|---|---|---|
| `id` | bigserial (PK) | Job ID |
| `stat_date` | date | Date being synced |
| `status` | text | `running` / `completed` / `failed` |
| `total_pages` | integer | Total API pages |
| `completed_pages` | integer | Pages processed |
| `failed_pages` | jsonb | Array of failed page details |

#### `leads`
Contacts synced from GoHighLevel.

| Column | Type | Description |
|---|---|---|
| `id` | text (PK) | GHL contact ID |
| `first_name` | text | First name |
| `last_name` | text | Last name |
| `company_name` | text | Company name |
| `email` | text | Email address |
| `phone` | text | Phone number |
| `tags` | text[] | Tag names |
| `date_added` | timestamptz | When the contact was added in GHL |
| `notes` | text | Contact notes |
| `first_dial_time` | timestamptz | First outbound call timestamp |
| `first_text_time` | timestamptz | First outbound text timestamp |
| `opportunity_id` | text | Associated opportunity ID |
| `enriched` | boolean | Whether dial/text times have been fetched |

#### `email_performance`
Per-sender email performance metrics aggregated across workspaces.

| Column | Type | Description |
|---|---|---|
| `id` | serial (PK) | Auto-increment ID |
| `workspace_id` | text | Workspace identifier |
| `workspace_name` | text | Workspace display name |
| `sender_id` | text | Upstream sender identifier |
| `email` | text | Email address |
| `domain` | text | Email domain (extracted from email) |
| `total_sent` | integer | Total emails sent |
| `total_replies` | integer | Total replies received |
| `reply_rate` | numeric(6,2) | Reply rate percentage |
| `total_bounced` | integer | Total bounced emails |
| `bounce_rate` | numeric(6,2) | Bounce rate percentage |
| `warmup_score` | numeric(6,2) | Warmup score (0–100) |
| `tags` | jsonb | Array of tag objects `[{ id, name }]` |
| `status` | text | Email account status |
| `synced_at` | timestamptz | Last sync timestamp |

Unique constraint on `(workspace_id, sender_id)`. Indexes on `domain` and `workspace_id`.

#### `sync_schedules`
One row per sync type. Controls automated scheduling.

| Column | Type | Description |
|---|---|---|
| `id` | bigint (PK) | Auto-increment ID |
| `type` | text (unique) | `contact_sync`, `performance_sync`, or `email_analyzer_sync` |
| `enabled` | boolean | Whether the schedule is active |
| `time_utc` | text | Daily run time in `HH:MM` UTC format |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

#### `sync_execution_log`
Unified execution history for all sync types.

| Column | Type | Description |
|---|---|---|
| `id` | bigint (PK) | Auto-increment ID |
| `schedule_id` | bigint (FK, nullable) | References `sync_schedules.id` |
| `type` | text | `contact_sync`, `performance_sync`, or `email_analyzer_sync` |
| `trigger` | text | `manual`, `scheduled`, or `retry` |
| `status` | text | `queued`, `running`, `completed`, or `failed` |
| `error_message` | text | Error details (if failed) |
| `contacts_fetched` | integer | Contacts fetched (contact_sync only) |
| `contacts_upserted` | integer | Contacts upserted (contact_sync only) |
| `sync_date` | text | Target date (performance_sync only) |
| `rows_synced` | integer | Rows synced (performance_sync only) |
| `retry_count` | integer | Number of retries |
| `started_at` | timestamptz | When the job started |
| `completed_at` | timestamptz | When the job finished |

---

## Supabase Client Variants

| Module | Context | Description |
|---|---|---|
| `src/lib/supabase.ts` | Browser | `createBrowserClient` — uses anon key, client-side |
| `src/lib/supabase-server.ts` | Server actions / middleware | `createServerClient` with cookie-based session |
| `src/lib/supabase-bg.ts` | API routes / background jobs | Service-role key, no cookie context |

---

## Sync System

### Types of Sync

| Sync Type | Source | Target Table | Trigger |
|---|---|---|---|
| **Account Sync** | Instantly API | `sender_accounts` + `account_daily_stats` | Manual (UI/API) |
| **Performance Sync** | Instantly API | `daily_performance` | Secret header / Scheduled |
| **Contact Sync** | GoHighLevel API | `leads` | Manual (UI) / Scheduled / Cron |
| **Leads Sync** | GoHighLevel API | `leads` | Manual (UI) — full sync |
| **Leads Enrich** | GoHighLevel Conversations | `leads` (dial/text times) | Manual (UI) |
| **Email Analyzer Sync** | Instantly API (all workspaces) | `email_performance` | Manual (UI) / Scheduled |

### Scheduler (`src/lib/scheduler.ts`)

An in-process scheduler using `node-cron` that runs every minute with a sequential job queue. On each tick it:

1. Reads all enabled rows from `sync_schedules`
2. Compares each schedule's `time_utc` against the current UTC time (`HH:MM`)
3. Checks for jobs started within the last minute (prevents duplicate triggers)
4. Creates a new `sync_execution_log` entry with `trigger = "scheduled"`:
   - If no job is currently running → status `"running"`, dispatched immediately
   - If another job is running → status `"queued"`, dispatched when the current job finishes
5. Jobs are dispatched sequentially via `dispatchJob()` → `processQueue()`:
   - `contact_sync` → `runContactSync(jobId)`
   - `performance_sync` → `runPerformanceSync(yesterday, yesterday)`
   - `email_analyzer_sync` → `runEmailAnalyzerSync(jobId)`

### Execution Logging

All sync operations (manual, scheduled, retry) are logged in the `sync_execution_log` table. This provides a unified history view in the Settings UI.

### Table Auto-Creation (`src/lib/ensure-tables.ts`)

On first API call, `ensureSyncTables()` probes for the `sync_schedules` table. If missing, it creates both tables via `exec_sql` RPC and migrates data from legacy tables (`contact_sync_schedule`, `contact_sync_jobs`). Runs once per process.

---

## Authentication

### User Auth
- Supabase email/password auth
- Login page at `/login` with server actions (`src/app/actions.ts`)
- Middleware (`src/proxy.ts`) refreshes session and redirects unauthenticated users

### API Auth
- **Session-based:** Most API routes check Supabase session (server-side)
- **Secret-based:** Sync endpoints accept `x-sync-secret` header for external cron triggers
- **Dual auth:** Contact sync supports both session and secret authentication

---

## UI Structure

### Layout
```
Root Layout (ThemeProvider → TooltipProvider → SidebarProvider)
└── DashboardTabsClient
    ├── Sidebar (collapsible icon mode)
    └── Main content area
        ├── Daily Performance — email stats cards + meeting stats cards
        ├── Performance Table — tabular performance data
        ├── Account Overview — summary cards + sender accounts table
        ├── Email Analyzer — email/domain performance views with bulk tag ops
        └── Settings (Automation tab)
            ├── Sync History — recent execution log with retry
            └── Sync Schedules dialog — create/edit/delete/toggle schedules
```

### Settings Panel — Automation Tab

The Automation section in Settings provides:

1. **Sync History Card** — shows recent sync runs from `sync_execution_log` with:
   - Type badge (Contact Sync / Performance Sync)
   - Trigger badge (Manual / Scheduled / Retry)
   - Status indicator (running/completed/failed)
   - Duration calculation
   - Retry button for failed jobs

2. **Sync Schedules Dialog** — manage automated daily syncs:
   - List view: shows all schedules with type, time (12-hour AM/PM IST), and enable/disable toggle
   - Add form: select type (only unscheduled types available) + set time
   - Edit form: replaces the list view while editing, with Cancel to return
   - Delete: remove a schedule
   - Max 3 schedules (one per type)

### Time Display
- All times stored in UTC in the database
- Frontend converts UTC ↔ IST (UTC+5:30) for display
- Schedule times shown in 12-hour AM/PM format (e.g., "2:30 PM IST")
- Time input uses 24-hour format (HTML `<input type="time">`)

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server) |
| `SEND_API_TOKEN` | Instantly API token |
| `LCH_API_TOKEN` | GoHighLevel API token |
| `SYNC_SECRET` | Secret for external cron sync triggers |
| `DEBUG` | Enable debug logging |

---

## API Route Map

| Method | Route | Description |
|---|---|---|
| GET | `/api/accounts` | List sender accounts |
| GET | `/api/account-stats` | Per-account daily stats |
| POST | `/api/account-sync` | Trigger account sync (secret) |
| POST | `/api/account-sync/manual` | Trigger account sync (session) |
| GET | `/api/account-sync/status` | Latest sync job status |
| GET | `/api/account-sync/history` | Sync job history |
| POST | `/api/account-sync/retry` | Retry failed sync pages |
| POST | `/api/performance-sync` | Sync performance data (secret) |
| GET | `/api/sender-emails` | Proxy: sender email list |
| GET | `/api/tags` | Proxy: tags list |
| GET | `/api/warmup/[id]` | Warmup stats for sender |
| GET | `/api/email-analyzer/emails` | Email performance records (paginated) |
| GET | `/api/email-analyzer/domains` | Domain-aggregated performance |
| GET | `/api/email-analyzer/sync` | Poll email analyzer sync status |
| POST | `/api/email-analyzer/sync` | Trigger email analyzer sync |
| POST | `/api/email-analyzer/tags` | Bulk add tags to senders |
| DELETE | `/api/email-analyzer/tags` | Bulk remove tags from senders |
| GET | `/api/leads` | List leads |
| POST | `/api/leads-sync` | Trigger full leads sync |
| GET | `/api/leads-sync` | Poll leads sync status |
| POST | `/api/leads-enrich` | Trigger leads enrichment |
| GET | `/api/leads-enrich` | Poll enrichment status |
| POST | `/api/contact-sync` | Trigger contact sync |
| GET | `/api/contact-sync` | Poll contact sync status |
| GET | `/api/schedules` | List sync schedules |
| POST | `/api/schedules` | Create sync schedule |
| PUT | `/api/schedules/[id]` | Update sync schedule |
| DELETE | `/api/schedules/[id]` | Delete sync schedule |
| GET | `/api/sync-history` | Unified sync execution history |
| POST | `/api/sync-history/retry` | Retry failed sync job |

---

## TypeScript Interfaces

Key interfaces in `src/lib/data.ts`:

- `DailyPerformance` — daily email + meeting metrics
- `EmailAccount` — sender account with stats
- `Tag` — tag ID + name
- `SyncType` — `"contact_sync" | "performance_sync" | "email_analyzer_sync"`
- `SyncTrigger` — `"manual" | "scheduled" | "retry"`
- `SyncSchedule` — schedule config (id, type, enabled, timeUtc)
- `SyncExecutionLog` — execution log entry with full job details (status includes `"queued"`)
- `EmailPerformance` — per-sender email performance metrics (id, workspaceId, email, domain, rates, warmupScore, tags)
- `DomainPerformance` — aggregated domain metrics (domain, totalEmails, avgWarmupScore, avgReplyRate, avgBounceRate)
