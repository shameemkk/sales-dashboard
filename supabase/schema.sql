
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
-- Contact Sync Jobs (execution history for scheduled syncs)
-- ============================================================
create table if not exists public.contact_sync_jobs (
  id              bigint generated always as identity primary key,
  status          text not null default 'running'
                    check (status in ('running', 'completed', 'failed')),
  error_message   text,
  contacts_fetched integer not null default 0,
  contacts_upserted integer not null default 0,
  retry_count     integer not null default 0,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_contact_sync_jobs_started
  on public.contact_sync_jobs (started_at desc);

-- ============================================================
-- Contact Sync Schedule (single-row config)
-- ============================================================
create table if not exists public.contact_sync_schedule (
  id         integer primary key default 1 check (id = 1),
  enabled    boolean not null default false,
  time_utc   text not null default '06:00',
  updated_at timestamptz not null default now()
);

insert into public.contact_sync_schedule (enabled, time_utc)
  values (false, '06:00')
  on conflict (id) do nothing;
