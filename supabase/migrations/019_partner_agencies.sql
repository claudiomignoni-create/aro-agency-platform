create table if not exists public.partner_agencies (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  legal_name text,
  agency_type text not null default 'partner_agency',
  status text not null default 'prospect',
  country text,
  country_code text,
  city text,
  state_region text,
  timezone text,
  address text,
  website_url text,
  instagram_url text,
  primary_email text,
  secondary_email text,
  phone text,
  whatsapp text,
  contact_name text,
  contact_role text,
  notes text,
  logo_storage_path text,
  default_currency text,
  default_payment_terms_days integer,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_agencies_type_check check (
    agency_type in (
      'mother_agency',
      'placement_agency',
      'receiving_agency',
      'partner_agency',
      'scouting_partner',
      'direct_booking_partner',
      'other'
    )
  ),
  constraint partner_agencies_status_check check (
    status in ('active', 'inactive', 'prospect', 'suspended', 'archived')
  ),
  constraint partner_agencies_payment_terms_check check (
    default_payment_terms_days is null or default_payment_terms_days >= 0
  ),
  constraint partner_agencies_country_code_check check (
    country_code is null or country_code = upper(country_code)
  )
);

create table if not exists public.partner_agency_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.partner_agencies(id) on delete cascade,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  line_id text,
  instagram text,
  contact_type text not null default 'booker',
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_agency_contacts_type_check check (
    contact_type in (
      'primary',
      'finance',
      'booker',
      'director',
      'models',
      'visas',
      'payments',
      'other'
    )
  )
);

create table if not exists public.model_partner_agencies (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  agency_id uuid not null references public.partner_agencies(id) on delete cascade,
  relationship_type text not null default 'receiving_agency',
  status text not null default 'active',
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_partner_agencies_relationship_check check (
    relationship_type in (
      'mother_agency',
      'placement_agency',
      'receiving_agency',
      'partner_agency',
      'scouting_partner',
      'direct_booking_partner',
      'other'
    )
  ),
  constraint model_partner_agencies_status_check check (
    status in ('active', 'inactive', 'archived')
  ),
  constraint model_partner_agencies_dates_check check (
    ends_on is null or starts_on is null or ends_on >= starts_on
  ),
  constraint model_partner_agencies_unique unique (model_id, agency_id, relationship_type)
);

create unique index if not exists partner_agencies_display_country_unique
on public.partner_agencies (lower(display_name), coalesce(country_code, ''))
where status <> 'archived';

create index if not exists partner_agencies_location_idx
on public.partner_agencies (country_code, city);

create index if not exists partner_agencies_status_idx
on public.partner_agencies (status);

create index if not exists partner_agency_contacts_agency_idx
on public.partner_agency_contacts (agency_id);

create index if not exists model_partner_agencies_model_idx
on public.model_partner_agencies (model_id, status);

create index if not exists model_partner_agencies_agency_idx
on public.model_partner_agencies (agency_id, status);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_partner_agencies_updated_at'
      and tgrelid = 'public.partner_agencies'::regclass
  ) then
    create trigger set_partner_agencies_updated_at
    before update on public.partner_agencies
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_partner_agency_contacts_updated_at'
      and tgrelid = 'public.partner_agency_contacts'::regclass
  ) then
    create trigger set_partner_agency_contacts_updated_at
    before update on public.partner_agency_contacts
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_model_partner_agencies_updated_at'
      and tgrelid = 'public.model_partner_agencies'::regclass
  ) then
    create trigger set_model_partner_agencies_updated_at
    before update on public.model_partner_agencies
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.partner_agencies enable row level security;
alter table public.partner_agency_contacts enable row level security;
alter table public.model_partner_agencies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_agencies'
      and policyname = 'admins manage partner agencies'
  ) then
    create policy "admins manage partner agencies"
    on public.partner_agencies for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_agency_contacts'
      and policyname = 'admins manage partner agency contacts'
  ) then
    create policy "admins manage partner agency contacts"
    on public.partner_agency_contacts for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'model_partner_agencies'
      and policyname = 'admins manage model partner agencies'
  ) then
    create policy "admins manage model partner agencies"
    on public.model_partner_agencies for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;
end $$;
