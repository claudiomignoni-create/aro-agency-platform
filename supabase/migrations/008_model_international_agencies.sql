create table if not exists public.model_international_agencies (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  agency_name text not null,
  country text,
  city text,
  contract_start_date date,
  contract_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists model_international_agencies_model_id_idx
on public.model_international_agencies(model_id);

drop trigger if exists set_model_international_agencies_updated_at on public.model_international_agencies;
create trigger set_model_international_agencies_updated_at
before update on public.model_international_agencies
for each row execute function public.set_updated_at();

alter table public.model_international_agencies enable row level security;

drop policy if exists "admins manage model international agencies" on public.model_international_agencies;
create policy "admins manage model international agencies"
on public.model_international_agencies for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
