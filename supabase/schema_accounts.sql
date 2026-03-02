-- Run in Supabase SQL editor

-- Table 1: Email sender accounts cache
create table sender_accounts (
    id bigint primary key,          -- API id (45500 etc)
    name text,
    email text,                     -- not unique — multiple accounts can share an email
    daily_limit integer,
    type text,
    status text,
    warmup_enabled boolean,
    tags jsonb default '[]',        -- full tags array from API e.g. [{"id":14,"name":"Outlook"}]
    created_at timestamptz,
    updated_at timestamptz,
    synced_at timestamptz default now()
);

-- Table 2: Per-account daily campaign stats
create table account_daily_stats (
    id bigserial primary key,
    sender_id bigint references sender_accounts(id) on delete cascade,
    stat_date date not null,

    sent integer default 0,
    replied integer default 0,
    total_opens integer default 0,
    unique_opens integer default 0,
    unsubscribed integer default 0,
    bounced integer default 0,
    interested integer default 0,

    created_at timestamptz default now(),

    unique(sender_id, stat_date)
);

create index account_daily_stats_sender_date_idx on account_daily_stats (sender_id, stat_date);
create index account_daily_stats_date_idx on account_daily_stats (stat_date);

-- Table 3: Sync job tracker
create table sync_jobs (
    id bigserial primary key,
    stat_date date not null,
    status text not null default 'running',  -- 'running' | 'completed' | 'failed'
    total_pages integer,
    completed_pages integer default 0,
    failed_pages jsonb default '[]',          -- [{"page": N, "error": "..."}]
    started_at timestamptz default now(),
    completed_at timestamptz
);
