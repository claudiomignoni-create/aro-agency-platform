create or replace function public.prevent_financial_job_material_rewrite_after_receipt()
returns trigger
language plpgsql
as $$
declare
  has_receipt boolean;
begin
  select exists (
    select 1
    from public.financial_job_payment_receipts r
    where r.financial_job_entry_id = old.id
      and r.status = 'posted'
  ) into has_receipt;

  if has_receipt and (
    new.job_id is distinct from old.job_id
    or new.model_id is distinct from old.model_id
    or new.client_id is distinct from old.client_id
    or new.currency is distinct from old.currency
    or new.model_base_fee is distinct from old.model_base_fee
    or new.agency_fee_percent is distinct from old.agency_fee_percent
    or new.agency_fee_amount is distinct from old.agency_fee_amount
    or new.tax_amount is distinct from old.tax_amount
    or new.additional_fees_amount is distinct from old.additional_fees_amount
    or new.model_deductions_amount is distinct from old.model_deductions_amount
    or new.client_amount_due is distinct from old.client_amount_due
    or new.model_net_amount is distinct from old.model_net_amount
  ) then
    raise exception 'receipted_financial_jobs_require_correction_workflow';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_financial_job_material_rewrite_after_receipt on public.financial_job_entries;
create trigger prevent_financial_job_material_rewrite_after_receipt
before update on public.financial_job_entries
for each row execute function public.prevent_financial_job_material_rewrite_after_receipt();

create or replace function public.prevent_receipted_job_model_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.financial_job_entries f
    join public.financial_job_payment_receipts r on r.financial_job_entry_id = f.id
    where f.job_id = old.job_id
      and f.model_id = old.model_id
      and r.status = 'posted'
  ) then
    raise exception 'receipted_job_models_require_correction_workflow';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_receipted_job_model_delete on public.job_models;
create trigger prevent_receipted_job_model_delete
before delete on public.job_models
for each row execute function public.prevent_receipted_job_model_delete();

create or replace view public.accounting_backfill_audit as
select
  count(*) as total_financial_entries,
  count(*) filter (where financial_review_required) as review_required_entries,
  count(*) filter (where model_base_fee is null) as missing_model_base_fee,
  count(*) filter (where client_amount_due is null) as missing_client_amount_due,
  count(*) filter (where model_net_amount is null) as missing_model_net_amount,
  count(*) filter (where job_id is null) as entries_without_job
from public.financial_job_entries;

revoke all on public.accounting_backfill_audit from anon, authenticated;
grant select on public.accounting_backfill_audit to authenticated;
