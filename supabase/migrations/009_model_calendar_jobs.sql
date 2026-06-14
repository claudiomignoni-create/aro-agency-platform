do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type public.job_type as enum ('job', 'casting', 'shoot', 'option', 'manual_block');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'draft',
      'client_requested',
      'booker_review',
      'quote_requested',
      'agency_approved',
      'waiting_model',
      'model_accepted',
      'confirmed',
      'declined',
      'canceled',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'job_model_status') then
    create type public.job_model_status as enum (
      'booker_review',
      'option',
      'agency_approved',
      'waiting_model',
      'accepted',
      'declined',
      'confirmed',
      'canceled',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'model_response_status') then
    create type public.model_response_status as enum (
      'not_released',
      'waiting',
      'accepted',
      'declined'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'calendar_block_status') then
    create type public.calendar_block_status as enum (
      'booker_review',
      'option',
      'agency_approved',
      'waiting_model',
      'accepted',
      'confirmed',
      'declined',
      'canceled',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'calendar_block_visibility') then
    create type public.calendar_block_visibility as enum (
      'admin_only',
      'model_private',
      'client_limited'
    );
  end if;
end;
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  type public.job_type not null,
  status public.job_status not null default 'booker_review',
  project_name text,
  brand_name text,
  brief text,
  start_at timestamptz not null,
  end_at timestamptz,
  call_time timestamptz,
  location_name text,
  address_line text,
  city text,
  country text,
  usage_term_months integer check (usage_term_months is null or usage_term_months in (6, 12, 24)),
  usage_description text,
  usage_scope text check (usage_scope is null or usage_scope in ('regional', 'national', 'international')),
  usage_countries text[] not null default '{}',
  client_budget numeric(12, 2),
  agency_fee_percent numeric(5, 2) not null default 20,
  final_amount numeric(12, 2),
  quote_requested boolean not null default false,
  transport_notes text,
  food_notes text,
  model_recommendations text,
  model_must_bring text,
  styling_notes text,
  beauty_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_end_after_start check (end_at is null or end_at > start_at)
);

create table if not exists public.job_models (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  status public.job_model_status not null default 'booker_review',
  model_response_status public.model_response_status not null default 'not_released',
  agency_approved_at timestamptz,
  model_responded_at timestamptz,
  fee_amount numeric(12, 2),
  final_amount numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, model_id)
);

create table if not exists public.model_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  type public.job_type not null,
  status public.calendar_block_status not null default 'booker_review',
  start_at timestamptz not null,
  end_at timestamptz,
  title text not null,
  visibility public.calendar_block_visibility not null default 'model_private',
  source text not null default 'jobs',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_calendar_blocks_end_after_start check (end_at is null or end_at > start_at)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_jobs_updated_at'
      and tgrelid = 'public.jobs'::regclass
  ) then
    create trigger set_jobs_updated_at
    before update on public.jobs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_job_models_updated_at'
      and tgrelid = 'public.job_models'::regclass
  ) then
    create trigger set_job_models_updated_at
    before update on public.job_models
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_model_calendar_blocks_updated_at'
      and tgrelid = 'public.model_calendar_blocks'::regclass
  ) then
    create trigger set_model_calendar_blocks_updated_at
    before update on public.model_calendar_blocks
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create index if not exists jobs_client_id_idx on public.jobs (client_id);
create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists jobs_start_at_idx on public.jobs (start_at);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_type_idx on public.jobs (type);

create index if not exists job_models_job_id_idx on public.job_models (job_id);
create index if not exists job_models_model_id_idx on public.job_models (model_id);
create index if not exists job_models_status_idx on public.job_models (status);
create index if not exists job_models_model_response_status_idx on public.job_models (model_response_status);

create index if not exists model_calendar_blocks_model_id_idx on public.model_calendar_blocks (model_id);
create index if not exists model_calendar_blocks_job_id_idx on public.model_calendar_blocks (job_id);
create index if not exists model_calendar_blocks_start_at_idx on public.model_calendar_blocks (start_at);
create index if not exists model_calendar_blocks_status_idx on public.model_calendar_blocks (status);
create index if not exists model_calendar_blocks_type_idx on public.model_calendar_blocks (type);

alter table public.jobs enable row level security;
alter table public.job_models enable row level security;
alter table public.model_calendar_blocks enable row level security;

drop policy if exists "admins manage jobs" on public.jobs;
create policy "admins manage jobs"
on public.jobs for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "clients read own jobs" on public.jobs;
create policy "clients read own jobs"
on public.jobs for select
using (
  exists (
    select 1
    from public.clients c
    where c.id = jobs.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "clients create own jobs" on public.jobs;
create policy "clients create own jobs"
on public.jobs for insert
with check (
  exists (
    select 1
    from public.clients c
    where c.id = jobs.client_id
      and c.user_id = auth.uid()
  )
  and created_by = auth.uid()
  and status in ('client_requested', 'booker_review', 'quote_requested')
);

drop policy if exists "admins manage job models" on public.job_models;
create policy "admins manage job models"
on public.job_models for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "clients read own job models" on public.job_models;
create policy "clients read own job models"
on public.job_models for select
using (
  exists (
    select 1
    from public.jobs j
    join public.clients c on c.id = j.client_id
    where j.id = job_models.job_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "models read own job models" on public.job_models;
create policy "models read own job models"
on public.job_models for select
using (
  exists (
    select 1
    from public.models m
    where m.id = job_models.model_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "models respond to released job models" on public.job_models;
create policy "models respond to released job models"
on public.job_models for update
using (
  model_response_status = 'waiting'
  and exists (
    select 1
    from public.models m
    where m.id = job_models.model_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.models m
    where m.id = job_models.model_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "admins manage calendar blocks" on public.model_calendar_blocks;
create policy "admins manage calendar blocks"
on public.model_calendar_blocks for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "models read own calendar blocks" on public.model_calendar_blocks;
create policy "models read own calendar blocks"
on public.model_calendar_blocks for select
using (
  exists (
    select 1
    from public.models m
    where m.id = model_calendar_blocks.model_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "clients read limited own calendar blocks" on public.model_calendar_blocks;
create policy "clients read limited own calendar blocks"
on public.model_calendar_blocks for select
using (
  visibility = 'client_limited'
  and exists (
    select 1
    from public.jobs j
    join public.clients c on c.id = j.client_id
    where j.id = model_calendar_blocks.job_id
      and c.user_id = auth.uid()
  )
);
