create table if not exists public.financial_job_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  financial_job_entry_id uuid not null references public.financial_job_entries(id) on delete restrict,
  amount numeric(14, 2) not null,
  currency public.finance_currency not null default 'BRL',
  received_on date not null,
  payment_method text,
  payment_reference text,
  internal_note text,
  status text not null default 'posted',
  void_reason text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  voided_by_user_id uuid references public.profiles(id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_job_payment_receipts_amount_check check (amount > 0),
  constraint financial_job_payment_receipts_status_check check (status in ('posted', 'void')),
  constraint financial_job_payment_receipts_void_reason_check check (
    status <> 'void' or (
      nullif(trim(void_reason), '') is not null
      and voided_by_user_id is not null
      and voided_at is not null
    )
  )
);

drop trigger if exists set_financial_job_payment_receipts_updated_at on public.financial_job_payment_receipts;
create trigger set_financial_job_payment_receipts_updated_at
before update on public.financial_job_payment_receipts
for each row execute function public.set_updated_at();

create index if not exists financial_job_payment_receipts_job_idx
on public.financial_job_payment_receipts (financial_job_entry_id, status, received_on);

create index if not exists financial_job_payment_receipts_created_by_idx
on public.financial_job_payment_receipts (created_by_user_id);

alter table public.financial_job_payment_receipts enable row level security;

drop policy if exists "admins select financial payment receipts" on public.financial_job_payment_receipts;
create policy "admins select financial payment receipts"
on public.financial_job_payment_receipts for select
using (public.current_user_role() = 'admin');

drop policy if exists "admins insert financial payment receipts" on public.financial_job_payment_receipts;
create policy "admins insert financial payment receipts"
on public.financial_job_payment_receipts for insert
with check (public.current_user_role() = 'admin');

drop policy if exists "admins update financial payment receipts" on public.financial_job_payment_receipts;
create policy "admins update financial payment receipts"
on public.financial_job_payment_receipts for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins delete financial payment receipts" on public.financial_job_payment_receipts;
create policy "admins delete financial payment receipts"
on public.financial_job_payment_receipts for delete
using (public.current_user_role() = 'admin');

create or replace function public.accounting_lock_key(p_scope text, p_id uuid, p_currency text default '')
returns bigint
language sql
immutable
as $$
  select ('x' || substr(md5(p_scope || ':' || coalesce(p_id::text, '') || ':' || coalesce(p_currency, '')), 1, 16))::bit(64)::bigint;
$$;

create or replace function public.validate_financial_job_payment_receipt()
returns trigger
language plpgsql
as $$
declare
  entry_currency text;
  entry_due numeric(14, 2);
  entry_review_required boolean;
  job_status text;
  posted_total numeric(14, 2);
begin
  if tg_op = 'UPDATE' and old.status = 'void' then
    raise exception 'voided_receipts_are_terminal';
  end if;

  if tg_op = 'UPDATE' and old.status = 'posted' and (
    new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.received_on is distinct from old.received_on
    or new.payment_method is distinct from old.payment_method
    or new.payment_reference is distinct from old.payment_reference
    or new.financial_job_entry_id is distinct from old.financial_job_entry_id
  ) then
    raise exception 'posted_receipts_are_immutable';
  end if;

  if new.status = 'void' and (
    nullif(trim(coalesce(new.void_reason, '')), '') is null
    or new.voided_by_user_id is null
    or new.voided_at is null
  ) then
    raise exception 'voided_receipts_require_attribution_and_reason';
  end if;

  select f.currency::text, f.client_amount_due, f.financial_review_required, j.status::text
    into entry_currency, entry_due, entry_review_required, job_status
  from public.financial_job_entries f
  left join public.jobs j on j.id = f.job_id
  where f.id = new.financial_job_entry_id;

  if entry_currency is null then
    raise exception 'financial_job_entry_not_found';
  end if;

  if new.currency::text <> entry_currency then
    raise exception 'receipt_currency_must_match_job_currency';
  end if;

  if entry_review_required or entry_due is null then
    raise exception 'financial_job_entry_requires_review';
  end if;

  if job_status not in ('confirmed', 'completed') then
    raise exception 'only_confirmed_or_completed_jobs_can_receive_payment';
  end if;

  if new.status = 'posted' then
    perform pg_advisory_xact_lock(public.accounting_lock_key('financial_job_payment_receipts', new.financial_job_entry_id, new.currency::text));

    select coalesce(sum(amount), 0)
      into posted_total
    from public.financial_job_payment_receipts
    where financial_job_entry_id = new.financial_job_entry_id
      and status = 'posted'
      and id is distinct from new.id;

    if posted_total + new.amount > entry_due then
      raise exception 'receipt_total_exceeds_job_amount_due';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_financial_job_payment_receipt on public.financial_job_payment_receipts;
create trigger validate_financial_job_payment_receipt
before insert or update on public.financial_job_payment_receipts
for each row execute function public.validate_financial_job_payment_receipt();

create or replace function public.prevent_financial_job_payment_receipt_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'accounting_receipts_cannot_be_deleted';

  return old;
end;
$$;

drop trigger if exists prevent_financial_job_payment_receipt_delete on public.financial_job_payment_receipts;
create trigger prevent_financial_job_payment_receipt_delete
before delete on public.financial_job_payment_receipts
for each row execute function public.prevent_financial_job_payment_receipt_delete();
