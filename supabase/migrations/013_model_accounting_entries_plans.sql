create table if not exists public.model_accounting_plans (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  entry_type text not null default 'advance',
  category text not null,
  custom_category_label text,
  title text not null,
  description text,
  amount numeric(14, 2) not null,
  currency public.finance_currency not null default 'BRL',
  cadence text not null,
  start_date date not null,
  occurrence_count integer not null,
  posting_mode text not null,
  request_key text not null,
  active boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_accounting_plans_amount_check check (amount > 0),
  constraint model_accounting_plans_entry_type_check check (entry_type in ('expense', 'advance')),
  constraint model_accounting_plans_cadence_check check (cadence in ('weekly', 'monthly')),
  constraint model_accounting_plans_occurrence_count_check check (occurrence_count between 1 and 60),
  constraint model_accounting_plans_posting_mode_check check (posting_mode in ('post_all_now', 'schedule_per_period')),
  constraint model_accounting_plans_category_check check (
    category in ('passagem', 'hospedagem', 'transporte', 'visto_documentacao', 'pocket_money', 'test_shoot_portfolio', 'material_book', 'alimentacao', 'taxas', 'outro')
  ),
  constraint model_accounting_plans_other_category_check check (
    category <> 'outro' or nullif(trim(coalesce(custom_category_label, '')), '') is not null
  ),
  constraint model_accounting_plans_request_key_unique unique (request_key)
);

drop trigger if exists set_model_accounting_plans_updated_at on public.model_accounting_plans;
create trigger set_model_accounting_plans_updated_at
before update on public.model_accounting_plans
for each row execute function public.set_updated_at();

create table if not exists public.model_accounting_entries (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  entry_type text not null,
  category text,
  custom_category_label text,
  title text not null,
  description text,
  amount numeric(14, 2) not null,
  currency public.finance_currency not null default 'BRL',
  occurred_on date not null,
  coverage_start_on date,
  coverage_end_on date,
  origin_city text,
  destination_city text,
  provider_name text,
  reference_code text,
  payment_method text,
  payment_reference text,
  internal_notes text,
  status text not null default 'posted',
  source_plan_id uuid references public.model_accounting_plans(id) on delete restrict,
  source_occurrence_date date,
  void_reason text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  voided_by_user_id uuid references public.profiles(id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_accounting_entries_amount_check check (amount > 0),
  constraint model_accounting_entries_status_check check (status in ('scheduled', 'posted', 'void')),
  constraint model_accounting_entries_type_check check (
    entry_type in ('expense', 'advance', 'model_payout', 'credit_adjustment', 'debit_adjustment')
  ),
  constraint model_accounting_entries_category_check check (
    category is null or category in ('passagem', 'hospedagem', 'transporte', 'visto_documentacao', 'pocket_money', 'test_shoot_portfolio', 'material_book', 'alimentacao', 'taxas', 'outro')
  ),
  constraint model_accounting_entries_expense_category_check check (
    entry_type not in ('expense', 'advance') or category is not null
  ),
  constraint model_accounting_entries_other_category_check check (
    category <> 'outro' or nullif(trim(coalesce(custom_category_label, '')), '') is not null
  ),
  constraint model_accounting_entries_void_reason_check check (
    status <> 'void' or (
      nullif(trim(void_reason), '') is not null
      and voided_by_user_id is not null
      and voided_at is not null
    )
  )
);

create unique index if not exists model_accounting_entries_plan_occurrence_unique_idx
on public.model_accounting_entries (source_plan_id, source_occurrence_date)
where source_plan_id is not null and source_occurrence_date is not null;

create index if not exists model_accounting_entries_model_idx
on public.model_accounting_entries (model_id, currency, occurred_on);

create index if not exists model_accounting_entries_status_idx
on public.model_accounting_entries (status);

drop trigger if exists set_model_accounting_entries_updated_at on public.model_accounting_entries;
create trigger set_model_accounting_entries_updated_at
before update on public.model_accounting_entries
for each row execute function public.set_updated_at();

alter table public.model_accounting_plans enable row level security;
alter table public.model_accounting_entries enable row level security;

drop policy if exists "admins manage model accounting plans" on public.model_accounting_plans;
create policy "admins manage model accounting plans"
on public.model_accounting_plans for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model accounting entries" on public.model_accounting_entries;
create policy "admins manage model accounting entries"
on public.model_accounting_entries for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create or replace function public.accounting_model_available_balance(
  p_model_id uuid,
  p_currency public.finance_currency,
  p_exclude_entry_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_jobs numeric(14, 2);
  credits numeric(14, 2);
  charges numeric(14, 2);
begin
  select coalesce(sum(f.model_net_amount), 0)
    into paid_jobs
  from public.financial_job_entries f
  where f.model_id = p_model_id
    and f.currency = p_currency
    and f.model_net_amount is not null
    and f.client_amount_due is not null
    and exists (
      select 1
      from public.financial_job_payment_receipts r
      where r.financial_job_entry_id = f.id
        and r.status = 'posted'
      group by r.financial_job_entry_id
      having coalesce(sum(r.amount), 0) >= f.client_amount_due
    );

  select
    coalesce(sum(amount) filter (where entry_type = 'credit_adjustment'), 0),
    coalesce(sum(amount) filter (where entry_type in ('expense', 'advance', 'model_payout', 'debit_adjustment')), 0)
    into credits, charges
  from public.model_accounting_entries
  where model_id = p_model_id
    and currency = p_currency
    and status = 'posted'
    and id is distinct from p_exclude_entry_id;

  return paid_jobs + credits - charges;
end;
$$;

create or replace function public.prevent_model_payout_overdraw()
returns trigger
language plpgsql
as $$
declare
  available numeric(14, 2);
begin
  if new.entry_type = 'model_payout' and new.status = 'posted' then
    perform pg_advisory_xact_lock(public.accounting_lock_key('model_accounting_payout', new.model_id, new.currency::text));
    available := public.accounting_model_available_balance(new.model_id, new.currency, new.id);

    if new.amount > available then
      raise exception 'model_payout_exceeds_available_balance';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_model_payout_overdraw on public.model_accounting_entries;
create trigger prevent_model_payout_overdraw
before insert or update on public.model_accounting_entries
for each row execute function public.prevent_model_payout_overdraw();

create or replace function public.prevent_accounting_entry_invalid_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'void' then
    raise exception 'voided_accounting_entries_are_terminal';
  end if;

  if old.status = 'posted' and (
    new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.model_id is distinct from old.model_id
    or new.entry_type is distinct from old.entry_type
    or new.occurred_on is distinct from old.occurred_on
  ) then
    raise exception 'posted_accounting_entries_are_immutable';
  end if;

  if new.status = 'void' and (
    nullif(trim(coalesce(new.void_reason, '')), '') is null
    or new.voided_by_user_id is null
    or new.voided_at is null
  ) then
    raise exception 'voided_accounting_entries_require_attribution_and_reason';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_accounting_entry_invalid_transition on public.model_accounting_entries;
create trigger prevent_accounting_entry_invalid_transition
before update on public.model_accounting_entries
for each row execute function public.prevent_accounting_entry_invalid_transition();

create or replace function public.prevent_posted_accounting_entry_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    raise exception 'posted_accounting_entries_cannot_be_deleted';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_posted_accounting_entry_delete on public.model_accounting_entries;
create trigger prevent_posted_accounting_entry_delete
before delete on public.model_accounting_entries
for each row execute function public.prevent_posted_accounting_entry_delete();
