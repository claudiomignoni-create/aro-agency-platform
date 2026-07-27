create table if not exists public.model_international_seasons (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  receiving_agency_id uuid not null references public.partner_agencies(id) on delete restrict,
  mother_agency_id uuid references public.partner_agencies(id) on delete restrict,
  trip_id uuid references public.model_trips(id) on delete set null,
  title text not null,
  country text not null,
  country_code text,
  city text not null,
  timezone text,
  destination_latitude numeric(9, 6),
  destination_longitude numeric(9, 6),
  contract_start_date date not null,
  contract_end_date date not null,
  duration_months integer,
  arrival_date date,
  departure_date date,
  status text not null default 'planned',
  contract_status text not null default 'pending_document',
  visa_status text not null default 'pending_information',
  accommodation_status text not null default 'pending_information',
  payment_status text not null default 'pending_calculation',
  settlement_status text not null default 'open',
  contract_currency text,
  pocket_money_amount numeric(14, 2),
  pocket_money_currency text,
  pocket_money_frequency text,
  pocket_money_start_date date,
  pocket_money_end_date date,
  pocket_money_expected_count integer,
  pocket_money_received_count integer,
  pocket_money_total_expected numeric(14, 2),
  pocket_money_total_received numeric(14, 2),
  gross_earnings numeric(14, 2),
  gross_earnings_currency text,
  model_share_percentage numeric(5, 2),
  receiving_agency_share_percentage numeric(5, 2),
  mother_agency_share_percentage numeric(5, 2),
  model_amount_due numeric(14, 2),
  receiving_agency_amount_due numeric(14, 2),
  mother_agency_amount_due numeric(14, 2),
  model_amount_paid numeric(14, 2),
  mother_agency_amount_received numeric(14, 2),
  receiving_agency_amount_settled numeric(14, 2),
  final_payment_terms_days integer,
  final_payment_due_date date,
  contract_reminder_date date,
  outbound_ticket_status text not null default 'pending_document',
  return_ticket_status text not null default 'pending_document',
  contract_document_status text not null default 'pending_document',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_international_seasons_dates_check check (contract_end_date >= contract_start_date),
  constraint model_international_seasons_arrival_check check (
    departure_date is null or arrival_date is null or departure_date >= arrival_date
  ),
  constraint model_international_seasons_duration_check check (
    duration_months is null or duration_months > 0
  ),
  constraint model_international_seasons_latitude_check check (
    destination_latitude is null or destination_latitude between -90 and 90
  ),
  constraint model_international_seasons_longitude_check check (
    destination_longitude is null or destination_longitude between -180 and 180
  ),
  constraint model_international_seasons_status_check check (
    status in (
      'planned',
      'preparing',
      'visa_pending',
      'booked',
      'traveling',
      'active',
      'ending_soon',
      'completed',
      'settlement_pending',
      'settled',
      'canceled'
    )
  ),
  constraint model_international_seasons_contract_status_check check (
    contract_status in ('pending_document', 'draft', 'active', 'expired', 'signed', 'canceled')
  ),
  constraint model_international_seasons_visa_status_check check (
    visa_status in ('pending_information', 'not_required', 'pending', 'approved', 'expired', 'denied')
  ),
  constraint model_international_seasons_accommodation_status_check check (
    accommodation_status in ('pending_information', 'not_required', 'pending', 'confirmed', 'completed')
  ),
  constraint model_international_seasons_payment_status_check check (
    payment_status in ('pending_calculation', 'pending', 'partially_paid', 'paid', 'overdue')
  ),
  constraint model_international_seasons_settlement_status_check check (
    settlement_status in ('open', 'pending', 'settlement_pending', 'settled', 'closed', 'canceled')
  ),
  constraint model_international_seasons_pocket_frequency_check check (
    pocket_money_frequency is null or pocket_money_frequency in ('weekly', 'biweekly', 'monthly', 'one_time', 'custom')
  ),
  constraint model_international_seasons_amounts_check check (
    (pocket_money_amount is null or pocket_money_amount >= 0)
    and (gross_earnings is null or gross_earnings >= 0)
    and (model_amount_due is null or model_amount_due >= 0)
    and (receiving_agency_amount_due is null or receiving_agency_amount_due >= 0)
    and (mother_agency_amount_due is null or mother_agency_amount_due >= 0)
    and (model_amount_paid is null or model_amount_paid >= 0)
    and (mother_agency_amount_received is null or mother_agency_amount_received >= 0)
    and (receiving_agency_amount_settled is null or receiving_agency_amount_settled >= 0)
  ),
  constraint model_international_seasons_percentages_check check (
    (model_share_percentage is null or model_share_percentage between 0 and 100)
    and (receiving_agency_share_percentage is null or receiving_agency_share_percentage between 0 and 100)
    and (mother_agency_share_percentage is null or mother_agency_share_percentage between 0 and 100)
  )
);

create unique index if not exists model_international_seasons_model_agency_contract_unique
on public.model_international_seasons (model_id, receiving_agency_id, contract_start_date, contract_end_date);

create index if not exists model_international_seasons_model_idx
on public.model_international_seasons (model_id, status);

create index if not exists model_international_seasons_receiving_agency_idx
on public.model_international_seasons (receiving_agency_id, status);

create index if not exists model_international_seasons_dates_idx
on public.model_international_seasons (contract_start_date, contract_end_date);

create index if not exists model_international_seasons_location_idx
on public.model_international_seasons (country_code, city);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_model_international_seasons_updated_at'
      and tgrelid = 'public.model_international_seasons'::regclass
  ) then
    create trigger set_model_international_seasons_updated_at
    before update on public.model_international_seasons
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.model_international_seasons enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'model_international_seasons'
      and policyname = 'admins manage model international seasons'
  ) then
    create policy "admins manage model international seasons"
    on public.model_international_seasons for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;
end $$;
