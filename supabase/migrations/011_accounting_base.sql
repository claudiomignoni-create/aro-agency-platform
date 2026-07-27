do $$
begin
  create type public.finance_currency as enum ('BRL', 'USD', 'EUR');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.financial_job_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete restrict,
  model_id uuid not null references public.models(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  job_date date not null,
  currency public.finance_currency not null default 'BRL',
  model_base_fee numeric(14, 2),
  agency_fee_percent numeric(5, 2),
  agency_fee_amount numeric(14, 2),
  tax_amount numeric(14, 2) not null default 0,
  additional_fees_amount numeric(14, 2) not null default 0,
  model_deductions_amount numeric(14, 2) not null default 0,
  model_deductions_note text,
  client_amount_due numeric(14, 2),
  model_net_amount numeric(14, 2),
  financial_status text not null default 'pending',
  financial_review_required boolean not null default false,
  internal_notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_job_entries_unique_model_job unique (job_id, model_id),
  constraint financial_job_entries_model_base_fee_check check (model_base_fee is null or model_base_fee >= 0),
  constraint financial_job_entries_agency_fee_percent_check check (agency_fee_percent is null or agency_fee_percent >= 0),
  constraint financial_job_entries_agency_fee_amount_check check (agency_fee_amount is null or agency_fee_amount >= 0),
  constraint financial_job_entries_tax_amount_check check (tax_amount >= 0),
  constraint financial_job_entries_additional_fees_amount_check check (additional_fees_amount >= 0),
  constraint financial_job_entries_model_deductions_amount_check check (model_deductions_amount >= 0),
  constraint financial_job_entries_client_amount_due_check check (client_amount_due is null or client_amount_due >= 0),
  constraint financial_job_entries_model_net_amount_check check (model_net_amount is null or model_net_amount >= 0),
  constraint financial_job_entries_status_check check (
    financial_status in (
      'no_entry',
      'pending',
      'partially_received',
      'received',
      'model_payout_pending',
      'paid_to_model',
      'void',
      'corrected'
    )
  )
);

drop trigger if exists set_financial_job_entries_updated_at on public.financial_job_entries;
create trigger set_financial_job_entries_updated_at
before update on public.financial_job_entries
for each row execute function public.set_updated_at();

create index if not exists financial_job_entries_job_id_idx
on public.financial_job_entries (job_id);

create index if not exists financial_job_entries_model_id_idx
on public.financial_job_entries (model_id);

create index if not exists financial_job_entries_client_id_idx
on public.financial_job_entries (client_id);

create index if not exists financial_job_entries_job_date_idx
on public.financial_job_entries (job_date desc);

create index if not exists financial_job_entries_currency_idx
on public.financial_job_entries (currency);

create index if not exists financial_job_entries_review_idx
on public.financial_job_entries (financial_review_required)
where financial_review_required = true;

alter table public.financial_job_entries enable row level security;

drop policy if exists "admins select financial job entries" on public.financial_job_entries;
create policy "admins select financial job entries"
on public.financial_job_entries for select
using (public.current_user_role() = 'admin');

drop policy if exists "admins insert financial job entries" on public.financial_job_entries;
create policy "admins insert financial job entries"
on public.financial_job_entries for insert
with check (public.current_user_role() = 'admin');

drop policy if exists "admins update financial job entries" on public.financial_job_entries;
create policy "admins update financial job entries"
on public.financial_job_entries for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins delete financial job entries" on public.financial_job_entries;
create policy "admins delete financial job entries"
on public.financial_job_entries for delete
using (public.current_user_role() = 'admin');

insert into public.financial_job_entries (
  agency_fee_amount,
  agency_fee_percent,
  client_amount_due,
  client_id,
  currency,
  financial_review_required,
  job_date,
  job_id,
  model_base_fee,
  model_id,
  model_net_amount,
  title
)
select
  case
    when jm.fee_amount is null or j.agency_fee_percent is null then null
    else round(jm.fee_amount * j.agency_fee_percent / 100, 2)
  end as agency_fee_amount,
  j.agency_fee_percent,
  case
    when jm.fee_amount is null then null
    when jm.final_amount is not null then jm.final_amount
    when jm.fee_amount is not null and j.agency_fee_percent is not null
      then round(jm.fee_amount + (jm.fee_amount * j.agency_fee_percent / 100), 2)
    else null
  end as client_amount_due,
  j.client_id,
  'BRL'::public.finance_currency,
  (
    jm.fee_amount is null
    or j.agency_fee_percent is null
    or j.status in ('canceled', 'declined')
  ) as financial_review_required,
  (j.start_at at time zone 'America/Sao_Paulo')::date,
  j.id,
  jm.fee_amount,
  jm.model_id,
  jm.fee_amount,
  coalesce(nullif(j.project_name, ''), nullif(j.brand_name, ''), 'Trabalho AROLAB')
from public.job_models jm
join public.jobs j on j.id = jm.job_id
where jm.model_id is not null
on conflict (job_id, model_id) do nothing;
