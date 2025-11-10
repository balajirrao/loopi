create schema if not exists public;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table public.routine_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  default_end_time time not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_routine_templates_updated_at
  before update on public.routine_templates
  for each row
  execute function public.set_updated_at();

create table public.routine_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.routine_templates (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  target_offset_minutes integer check (target_offset_minutes is null or target_offset_minutes >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_routine_template_tasks_updated_at
  before update on public.routine_template_tasks
  for each row
  execute function public.set_updated_at();

create index routine_template_tasks_template_offset_idx
  on public.routine_template_tasks (template_id, coalesce(target_offset_minutes, 2147483647));

create type public.routine_run_status as enum ('planned', 'in_progress', 'completed', 'abandoned');

create table public.routine_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.routine_templates (id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target_end_time timestamptz not null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  canceled_at timestamptz,
  status public.routine_run_status not null default 'in_progress',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_routine_runs_updated_at
  before update on public.routine_runs
  for each row
  execute function public.set_updated_at();

create index routine_runs_user_id_status_idx
  on public.routine_runs (user_id, status);

create table public.routine_run_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.routine_runs (id) on delete cascade,
  template_task_id uuid references public.routine_template_tasks (id) on delete set null,
  title text not null,
  target_time timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_routine_run_tasks_updated_at
  before update on public.routine_run_tasks
  for each row
  execute function public.set_updated_at();

create index routine_run_tasks_run_time_idx
  on public.routine_run_tasks (run_id, coalesce(target_time, 'infinity'::timestamptz));

alter table public.routine_templates enable row level security;
alter table public.routine_template_tasks enable row level security;
alter table public.routine_runs enable row level security;
alter table public.routine_run_tasks enable row level security;

create policy "Users can manage their routine templates"
  on public.routine_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can access tasks for their templates"
  on public.routine_template_tasks
  for all
  using (
    exists (
      select 1
      from public.routine_templates t
      where t.id = routine_template_tasks.template_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.routine_templates t
      where t.id = routine_template_tasks.template_id
        and t.user_id = auth.uid()
    )
  );

create policy "Users can manage their routine runs"
  on public.routine_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can access tasks for their routine runs"
  on public.routine_run_tasks
  for all
  using (
    exists (
      select 1
      from public.routine_runs r
      where r.id = routine_run_tasks.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.routine_runs r
      where r.id = routine_run_tasks.run_id
        and r.user_id = auth.uid()
    )
  );
