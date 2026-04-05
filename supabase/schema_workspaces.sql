-- Workspaces table: stores Instantly workspace info and API tokens
create table if not exists public.workspaces (
  id         text primary key,
  name       text not null,
  api_token  text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "Authenticated read workspaces"
  on public.workspaces for select
  to authenticated
  using (true);

create policy "Authenticated manage workspaces"
  on public.workspaces for all
  to authenticated
  using (true)
  with check (true);
