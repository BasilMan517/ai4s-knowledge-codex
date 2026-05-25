create table if not exists public.ai4s_workspaces (
  id text primary key,
  topic text not null,
  status text not null default 'ready',
  paper_count integer not null default 0,
  fact_count integer not null default 0,
  workspace jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai4s_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.ai4s_workspaces(id) on delete cascade,
  filename text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, filename)
);

create index if not exists ai4s_workspaces_updated_at_idx on public.ai4s_workspaces (updated_at desc);
create index if not exists ai4s_artifacts_workspace_id_idx on public.ai4s_artifacts (workspace_id);

create or replace function public.ai4s_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai4s_workspaces_updated_at on public.ai4s_workspaces;
create trigger set_ai4s_workspaces_updated_at
before update on public.ai4s_workspaces
for each row execute function public.ai4s_set_updated_at();

drop trigger if exists set_ai4s_artifacts_updated_at on public.ai4s_artifacts;
create trigger set_ai4s_artifacts_updated_at
before update on public.ai4s_artifacts
for each row execute function public.ai4s_set_updated_at();
