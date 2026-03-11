
-- Daily performance metrics (one row per date)
create table public.daily_performance (
  date date primary key,
  total_emails_sent integer not null default 0,
  total_new_leads_contacted integer not null default 0,
  total_replies integer not null default 0,
  total_positive_replies integer not null default 0,
  -- total_auto_follow_up_sent integer not null default 0, -- removed
  meetings_booked integer not null default 0,
  meetings_no_show integer not null default 0,
  meetings_show_up integer not null default 0,
  meetings_disqualified integer not null default 0,
  meetings_canceled integer not null default 0,
  meetings_rescheduled integer not null default 0,
  meetings_closed integer not null default 0,
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
