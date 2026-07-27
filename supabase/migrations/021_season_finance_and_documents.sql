create table if not exists public.international_season_revenue_shares (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.model_international_seasons(id) on delete cascade,
  participant_type text not null,
  agency_id uuid references public.partner_agencies(id) on delete restrict,
  model_id uuid references public.models(id) on delete restrict,
  percentage numeric(5, 2) not null,
  calculated_amount numeric(14, 2),
  amount_paid numeric(14, 2),
  currency text,
  status text not null default 'configured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_revenue_shares_type_check check (
    participant_type in ('model', 'receiving_agency', 'mother_agency', 'local_partner', 'manager', 'other')
  ),
  constraint international_season_revenue_shares_percentage_check check (percentage >= 0 and percentage <= 100),
  constraint international_season_revenue_shares_amounts_check check (
    (calculated_amount is null or calculated_amount >= 0)
    and (amount_paid is null or amount_paid >= 0)
  ),
  constraint international_season_revenue_shares_status_check check (
    status in ('configured', 'pending', 'partially_paid', 'paid', 'settled', 'void')
  ),
  constraint international_season_revenue_shares_participant_check check (
    (participant_type = 'model' and model_id is not null)
    or (
      participant_type <> 'model'
      and (
        agency_id is not null
        or participant_type in ('mother_agency', 'manager', 'other')
      )
    )
  )
);

create unique index if not exists international_season_revenue_shares_unique_participant
on public.international_season_revenue_shares (
  season_id,
  participant_type,
  coalesce(agency_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table if not exists public.international_season_financial_movements (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.model_international_seasons(id) on delete cascade,
  movement_type text not null,
  participant_type text,
  agency_id uuid references public.partner_agencies(id) on delete restrict,
  model_id uuid references public.models(id) on delete restrict,
  amount numeric(14, 2) not null,
  currency text not null,
  occurred_on date not null default current_date,
  expected_on date,
  status text not null default 'posted',
  reference text,
  proof_document_id uuid,
  notes text,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_financial_movements_type_check check (
    movement_type in (
      'gross_earning',
      'model_payment',
      'mother_agency_receipt',
      'receiving_agency_settlement',
      'pocket_money',
      'adjustment_credit',
      'adjustment_debit',
      'payout',
      'receipt'
    )
  ),
  constraint international_season_financial_movements_participant_check check (
    participant_type is null
    or participant_type in ('model', 'receiving_agency', 'mother_agency', 'local_partner', 'manager', 'other')
  ),
  constraint international_season_financial_movements_amount_check check (amount > 0),
  constraint international_season_financial_movements_status_check check (status in ('scheduled', 'posted', 'void')),
  constraint international_season_financial_movements_void_check check (
    status <> 'void' or (voided_at is not null and void_reason is not null)
  )
);

create table if not exists public.international_season_documents (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.model_international_seasons(id) on delete cascade,
  document_type text not null,
  title text not null,
  storage_bucket text not null default 'model-documents',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  version_number integer not null default 1,
  replaced_by_id uuid references public.international_season_documents(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_documents_type_check check (
    document_type in (
      'contract',
      'addendum',
      'outbound_ticket',
      'return_ticket',
      'e_ticket',
      'booking_confirmation',
      'visa',
      'visa_photo',
      'passport_related',
      'travel_insurance',
      'accommodation',
      'authorization',
      'pocket_money_proof',
      'payment_proof',
      'financial_closing',
      'other'
    )
  ),
  constraint international_season_documents_private_bucket_check check (storage_bucket = 'model-documents'),
  constraint international_season_documents_storage_prefix_check check (storage_path like 'travel/%'),
  constraint international_season_documents_size_check check (file_size_bytes is null or file_size_bytes > 0)
);

create table if not exists public.international_season_visas (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.model_international_seasons(id) on delete cascade,
  country text not null,
  visa_type text,
  masked_number text,
  issued_on date,
  valid_from date,
  valid_until date,
  entries_count integer,
  status text not null default 'pending_information',
  document_id uuid references public.international_season_documents(id) on delete set null,
  photo_document_id uuid references public.international_season_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_visas_status_check check (
    status in ('pending_information', 'not_required', 'pending', 'approved', 'expired', 'denied')
  ),
  constraint international_season_visas_masked_number_check check (
    masked_number is null or masked_number not like '%.%'
  )
);

create table if not exists public.international_season_pocket_money_payments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.model_international_seasons(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null,
  expected_on date,
  received_on date,
  status text not null default 'expected',
  proof_document_id uuid references public.international_season_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_pocket_money_amount_check check (amount > 0),
  constraint international_season_pocket_money_status_check check (
    status in ('expected', 'received', 'late', 'void')
  )
);

create index if not exists international_season_revenue_shares_season_idx
on public.international_season_revenue_shares (season_id);

create index if not exists international_season_financial_movements_season_idx
on public.international_season_financial_movements (season_id, occurred_on desc);

create index if not exists international_season_documents_season_idx
on public.international_season_documents (season_id, document_type);

create index if not exists international_season_pocket_money_season_idx
on public.international_season_pocket_money_payments (season_id, expected_on);

create or replace function public.validate_international_season_share_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_season_id uuid;
  total_percentage numeric(7, 2);
begin
  affected_season_id := coalesce(new.season_id, old.season_id);

  select coalesce(sum(percentage), 0)
  into total_percentage
  from public.international_season_revenue_shares
  where season_id = affected_season_id
    and status <> 'void';

  if total_percentage <> 100 then
    raise exception 'international_season_revenue_shares_must_total_100';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_closed_season_finance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  season_status text;
begin
  select settlement_status
  into season_status
  from public.model_international_seasons
  where id = coalesce(new.season_id, old.season_id);

  if season_status in ('settled', 'closed') then
    raise exception 'closed_international_season_finance_is_immutable';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_international_season_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'international_season_records_cannot_be_hard_deleted';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'validate_international_season_share_total'
      and tgrelid = 'public.international_season_revenue_shares'::regclass
  ) then
    create constraint trigger validate_international_season_share_total
    after insert or update or delete on public.international_season_revenue_shares
    deferrable initially deferred
    for each row execute function public.validate_international_season_share_total();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_closed_season_share_change'
      and tgrelid = 'public.international_season_revenue_shares'::regclass
  ) then
    create trigger prevent_closed_season_share_change
    before insert or update or delete on public.international_season_revenue_shares
    for each row execute function public.prevent_closed_season_finance_change();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_closed_season_financial_movement_change'
      and tgrelid = 'public.international_season_financial_movements'::regclass
  ) then
    create trigger prevent_closed_season_financial_movement_change
    before insert or update or delete on public.international_season_financial_movements
    for each row execute function public.prevent_closed_season_finance_change();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_international_season_financial_movement_delete'
      and tgrelid = 'public.international_season_financial_movements'::regclass
  ) then
    create trigger prevent_international_season_financial_movement_delete
    before delete on public.international_season_financial_movements
    for each row execute function public.prevent_international_season_hard_delete();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_international_season_document_delete'
      and tgrelid = 'public.international_season_documents'::regclass
  ) then
    create trigger prevent_international_season_document_delete
    before delete on public.international_season_documents
    for each row execute function public.prevent_international_season_hard_delete();
  end if;
end $$;

alter table public.international_season_revenue_shares enable row level security;
alter table public.international_season_financial_movements enable row level security;
alter table public.international_season_documents enable row level security;
alter table public.international_season_visas enable row level security;
alter table public.international_season_pocket_money_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'international_season_revenue_shares'
      and policyname = 'admins manage international season revenue shares'
  ) then
    create policy "admins manage international season revenue shares"
    on public.international_season_revenue_shares for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'international_season_financial_movements'
      and policyname = 'admins manage international season financial movements'
  ) then
    create policy "admins manage international season financial movements"
    on public.international_season_financial_movements for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'international_season_documents'
      and policyname = 'admins manage international season documents'
  ) then
    create policy "admins manage international season documents"
    on public.international_season_documents for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'international_season_visas'
      and policyname = 'admins manage international season visas'
  ) then
    create policy "admins manage international season visas"
    on public.international_season_visas for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'international_season_pocket_money_payments'
      and policyname = 'admins manage international season pocket money'
  ) then
    create policy "admins manage international season pocket money"
    on public.international_season_pocket_money_payments for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;
end $$;
