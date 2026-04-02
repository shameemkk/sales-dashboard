
-- Daily performance metrics (one row per date)
create table public.daily_performance (
  date date primary key,
  total_emails_sent integer not null default 0,
  total_new_leads_contacted integer not null default 0,
  total_replies integer not null default 0,
  total_positive_replies integer not null default 0,
  -- total_auto_follow_up_sent integer not null default 0, -- removed
  today_appointments integer not null default 0,
  meetings_no_show integer not null default 0,
  meetings_show_up integer not null default 0,
  meetings_disqualified integer not null default 0,
  meetings_canceled integer not null default 0,
  meetings_rescheduled integer not null default 0,
  meetings_closed integer not null default 0,
  bookings integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- -- Optional: RLS
-- alter table public.daily_performance enable row level security;

-- create policy "Allow read daily_performance" on public.daily_performance
--   for select using (true);

-- Optional: updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_daily_performance_updated_at
  before update on public.daily_performance
  for each row execute function public.set_updated_at();

-- ============================================================
-- Leads (synced from GoHighLevel)
-- ============================================================
create table if not exists public.leads (
  id text primary key,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  tags text[] not null default '{}',
  date_added timestamptz,
  notes text,
  first_dial_time timestamptz,
  first_text_time timestamptz,
  opportunity_id text,
  synced_at timestamptz not null default now(),
  enriched boolean not null default false
);

-- Indexes for search, filtering, and enrichment
create index if not exists idx_leads_date_added on public.leads (date_added desc);
create index if not exists idx_leads_email on public.leads (email);
create index if not exists idx_leads_phone on public.leads (phone);
create index if not exists idx_leads_company_name on public.leads (company_name);
create index if not exists idx_leads_enriched on public.leads (enriched) where enriched = false;

-- RLS
alter table public.leads enable row level security;

create policy "Authenticated users can read leads"
  on public.leads for select
  to authenticated
  using (true);

create policy "Service role can manage leads"
  on public.leads for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- Sync Schedules (one row per sync type)
-- ============================================================
create table if not exists public.sync_schedules (
  id          bigint generated always as identity primary key,
  type        text not null unique
                check (type in ('contact_sync', 'performance_sync')),
  enabled     boolean not null default false,
  time_utc    text not null default '06:00',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Sync Execution Log (unified history for all sync types)
-- ============================================================
create table if not exists public.sync_execution_log (
  id                 bigint generated always as identity primary key,
  schedule_id        bigint references public.sync_schedules(id) on delete set null,
  type               text not null
                       check (type in ('contact_sync', 'performance_sync')),
  trigger            text not null default 'manual'
                       check (trigger in ('manual', 'scheduled', 'retry')),
  status             text not null default 'running'
                       check (status in ('running', 'completed', 'failed')),
  error_message      text,
  contacts_fetched   integer,
  contacts_upserted  integer,
  sync_date          text,
  rows_synced        integer,
  retry_count        integer not null default 0,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists idx_sync_exec_log_type
  on public.sync_execution_log (type);
create index if not exists idx_sync_exec_log_started
  on public.sync_execution_log (started_at desc);
