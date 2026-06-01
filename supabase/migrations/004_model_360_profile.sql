alter table public.models
add column if not exists stage_name text,
add column if not exists pronouns text,
add column if not exists is_minor boolean not null default false,
add column if not exists current_city text,
add column if not exists current_country text,
add column if not exists base_city text,
add column if not exists base_country text,
add column if not exists model_type text,
add column if not exists shoe_size_br text,
add column if not exists shoe_size_eu text,
add column if not exists shoe_size_us text,
add column if not exists dress_size_br text,
add column if not exists dress_size_eu text,
add column if not exists dress_size_us text,
add column if not exists shirt_size text,
add column if not exists pants_size text,
add column if not exists suit_size text,
add column if not exists hair_length text,
add column if not exists hair_type text,
add column if not exists skin_tone text,
add column if not exists tattoos text,
add column if not exists piercings text,
add column if not exists visible_scars text,
add column if not exists braces text,
add column if not exists whatsapp text,
add column if not exists wechat text,
add column if not exists emergency_contact_name text,
add column if not exists emergency_contact_phone text,
add column if not exists emergency_contact_relationship text,
add column if not exists address_line text,
add column if not exists city text,
add column if not exists state text,
add column if not exists country text,
add column if not exists postal_code text,
add column if not exists last_profile_update_at timestamptz,
add column if not exists last_media_update_at timestamptz,
add column if not exists last_measurements_update_at timestamptz,
add column if not exists last_update_request_sent_at timestamptz,
add column if not exists profile_reviewed_at timestamptz;

update public.models
set
  stage_name = coalesce(stage_name, display_name),
  current_city = coalesce(current_city, location),
  shoe_size_br = coalesce(shoe_size_br, shoe_size),
  dress_size_br = coalesce(dress_size_br, clothing_size),
  last_profile_update_at = coalesce(last_profile_update_at, updated_at),
  last_measurements_update_at = coalesce(last_measurements_update_at, updated_at)
where stage_name is null
  or current_city is null
  or shoe_size_br is null
  or dress_size_br is null
  or last_profile_update_at is null
  or last_measurements_update_at is null;

create table if not exists public.model_social_links (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete cascade,
  instagram text,
  tiktok text,
  youtube text,
  xiaohongshu text,
  weibo text,
  wechat_id text,
  website text,
  external_portfolio_url text,
  composite_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_documents (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete cascade,
  cpf text,
  rg text,
  passport_number text,
  passport_expiration date,
  visa_us text,
  visa_eu text,
  visa_china text,
  other_visas text,
  legal_guardian_name text,
  legal_guardian_document text,
  legal_guardian_phone text,
  legal_guardian_email text,
  travel_authorization_file text,
  agency_contract_file text,
  proof_of_address_file text,
  banking_info_private text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_skills (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete cascade,
  acting boolean not null default false,
  dancing boolean not null default false,
  singing boolean not null default false,
  swimming boolean not null default false,
  surfing boolean not null default false,
  skating boolean not null default false,
  skiing boolean not null default false,
  yoga boolean not null default false,
  pilates boolean not null default false,
  running boolean not null default false,
  gym boolean not null default false,
  martial_arts boolean not null default false,
  cycling boolean not null default false,
  horseback_riding boolean not null default false,
  drives_car boolean not null default false,
  drives_motorcycle boolean not null default false,
  has_drivers_license boolean not null default false,
  languages text[] not null default '{}',
  instruments text[] not null default '{}',
  runway_experience boolean not null default false,
  ecommerce_experience boolean not null default false,
  beauty_experience boolean not null default false,
  tv_commercial_experience boolean not null default false,
  approved_for_client_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_work_history (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  brand text not null,
  year integer,
  market text,
  category text,
  photographer text,
  client text,
  agency text,
  link text,
  notes text,
  approved_for_client_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists model_work_history_model_id_idx
on public.model_work_history(model_id);

create table if not exists public.model_health_logistics (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete cascade,
  food_restrictions text,
  allergies text,
  medications_notes text,
  travel_availability text,
  passport_valid boolean not null default false,
  can_travel_internationally boolean not null default false,
  accepts_out_of_city_jobs boolean not null default false,
  accepts_hair_change boolean not null default false,
  accepts_lingerie boolean not null default false,
  accepts_swimwear boolean not null default false,
  accepts_artistic_nudity boolean not null default false,
  commercial_restrictions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_representation (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete cascade,
  mother_agency text,
  international_agencies text[] not null default '{}',
  available_markets text[] not null default '{}',
  previous_markets text[] not null default '{}',
  exclusive_contract boolean not null default false,
  contract_start_date date,
  contract_end_date date,
  agency_commission numeric(5, 2),
  model_commission numeric(5, 2),
  responsible_booker text,
  commercial_status text,
  strategic_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_update_requests (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  email_to text,
  requested_sections text[] not null default '{}',
  message text,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists model_update_requests_model_id_idx
on public.model_update_requests(model_id);

drop trigger if exists set_model_social_links_updated_at on public.model_social_links;
create trigger set_model_social_links_updated_at
before update on public.model_social_links
for each row execute function public.set_updated_at();

drop trigger if exists set_model_documents_updated_at on public.model_documents;
create trigger set_model_documents_updated_at
before update on public.model_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_model_skills_updated_at on public.model_skills;
create trigger set_model_skills_updated_at
before update on public.model_skills
for each row execute function public.set_updated_at();

drop trigger if exists set_model_work_history_updated_at on public.model_work_history;
create trigger set_model_work_history_updated_at
before update on public.model_work_history
for each row execute function public.set_updated_at();

drop trigger if exists set_model_health_logistics_updated_at on public.model_health_logistics;
create trigger set_model_health_logistics_updated_at
before update on public.model_health_logistics
for each row execute function public.set_updated_at();

drop trigger if exists set_model_representation_updated_at on public.model_representation;
create trigger set_model_representation_updated_at
before update on public.model_representation
for each row execute function public.set_updated_at();

drop trigger if exists set_model_update_requests_updated_at on public.model_update_requests;
create trigger set_model_update_requests_updated_at
before update on public.model_update_requests
for each row execute function public.set_updated_at();

alter table public.model_social_links enable row level security;
alter table public.model_documents enable row level security;
alter table public.model_skills enable row level security;
alter table public.model_work_history enable row level security;
alter table public.model_health_logistics enable row level security;
alter table public.model_representation enable row level security;
alter table public.model_update_requests enable row level security;

drop policy if exists "clients read published models" on public.models;
drop policy if exists "models read by owner or admin" on public.models;
create policy "models read by owner or admin"
on public.models for select
using (
  public.current_user_role() = 'admin'
  or user_id = auth.uid()
);

drop policy if exists "media read by owner admin or eligible client" on public.model_media;
create policy "media read by owner admin or eligible client"
on public.model_media for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.models m
    where m.id = model_media.model_id
      and m.user_id = auth.uid()
  )
  or (
    public.current_user_role() = 'client'
    and media_type <> 'document'
    and status = 'approved'
    and visibility in ('public', 'client_only')
    and exists (
      select 1
      from public.models m
      where m.id = model_media.model_id
        and m.status = 'approved'
        and m.is_published = true
    )
  )
);

drop policy if exists "admins manage model social links" on public.model_social_links;
create policy "admins manage model social links"
on public.model_social_links for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model documents" on public.model_documents;
create policy "admins manage model documents"
on public.model_documents for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model skills" on public.model_skills;
create policy "admins manage model skills"
on public.model_skills for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model work history" on public.model_work_history;
create policy "admins manage model work history"
on public.model_work_history for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model health logistics" on public.model_health_logistics;
create policy "admins manage model health logistics"
on public.model_health_logistics for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model representation" on public.model_representation;
create policy "admins manage model representation"
on public.model_representation for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage model update requests" on public.model_update_requests;
create policy "admins manage model update requests"
on public.model_update_requests for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop view if exists public.model_client_work_history;
drop view if exists public.model_client_skills;
drop view if exists public.model_client_profiles;

create view public.model_client_profiles as
select
  id,
  coalesce(stage_name, display_name) as stage_name,
  display_name,
  categories,
  model_type,
  current_city,
  current_country,
  base_city,
  base_country,
  height_cm,
  bust_cm,
  waist_cm,
  hips_cm,
  shoe_size_br,
  shoe_size_eu,
  shoe_size_us,
  dress_size_br,
  dress_size_eu,
  dress_size_us,
  shirt_size,
  pants_size,
  suit_size,
  hair_color,
  hair_length,
  hair_type,
  eye_color,
  skin_tone,
  updated_at
from public.models
where status = 'approved'
  and is_published = true;

create view public.model_client_skills as
select
  s.model_id,
  s.acting,
  s.dancing,
  s.singing,
  s.swimming,
  s.surfing,
  s.skating,
  s.skiing,
  s.yoga,
  s.pilates,
  s.running,
  s.gym,
  s.martial_arts,
  s.cycling,
  s.horseback_riding,
  s.drives_car,
  s.drives_motorcycle,
  s.has_drivers_license,
  s.languages,
  s.instruments,
  s.runway_experience,
  s.ecommerce_experience,
  s.beauty_experience,
  s.tv_commercial_experience
from public.model_skills s
join public.models m on m.id = s.model_id
where s.approved_for_client_view = true
  and m.status = 'approved'
  and m.is_published = true;

create view public.model_client_work_history as
select
  w.id,
  w.model_id,
  w.brand,
  w.year,
  w.market,
  w.category,
  w.photographer,
  w.client,
  w.agency,
  w.link,
  w.notes
from public.model_work_history w
join public.models m on m.id = w.model_id
where w.approved_for_client_view = true
  and m.status = 'approved'
  and m.is_published = true;

grant select on public.model_client_profiles to authenticated;
grant select on public.model_client_skills to authenticated;
grant select on public.model_client_work_history to authenticated;
