alter table public.clients
  add column if not exists billing_person_type text,
  add column if not exists billing_trade_name text,
  add column if not exists billing_legal_name text,
  add column if not exists billing_cnpj text,
  add column if not exists billing_cpf text,
  add column if not exists billing_state_registration text,
  add column if not exists billing_municipal_registration text,
  add column if not exists billing_tax_regime text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_address_line text,
  add column if not exists billing_address_number text,
  add column if not exists billing_address_complement text,
  add column if not exists billing_neighborhood text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_country text,
  add column if not exists billing_contact_name text,
  add column if not exists billing_email text,
  add column if not exists billing_phone text,
  add column if not exists payment_terms text,
  add column if not exists default_currency public.finance_currency not null default 'BRL',
  add column if not exists invoice_notes text,
  add column if not exists tax_notes text,
  add column if not exists intl_trading_name text,
  add column if not exists intl_legal_company_name text,
  add column if not exists intl_country text,
  add column if not exists intl_tax_id text,
  add column if not exists intl_vat_number text,
  add column if not exists intl_company_registration_number text,
  add column if not exists intl_billing_address text,
  add column if not exists intl_billing_city text,
  add column if not exists intl_billing_state text,
  add column if not exists intl_billing_postal_code text,
  add column if not exists intl_billing_country text,
  add column if not exists intl_billing_contact text,
  add column if not exists intl_billing_email text,
  add column if not exists intl_payment_terms text,
  add column if not exists intl_invoice_notes text,
  add column if not exists intl_tax_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_billing_person_type_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
    add constraint clients_billing_person_type_check
    check (billing_person_type is null or billing_person_type in ('pf', 'pj', 'international'));
  end if;
end;
$$;
