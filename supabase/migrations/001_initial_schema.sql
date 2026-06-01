create type public.user_role as enum ('admin', 'model', 'client');
create type public.model_status as enum ('draft', 'pending_review', 'approved', 'archived');
create type public.media_type as enum ('portfolio', 'polaroid', 'video', 'document');
create type public.media_status as enum ('pending_review', 'approved', 'rejected', 'archived');
create type public.media_visibility as enum ('public', 'client_only', 'private');
create type public.availability_status as enum ('available', 'unavailable', 'tentative');
create type public.request_status as enum ('new', 'reviewing', 'proposed', 'confirmed', 'declined', 'archived');
create type public.booking_status as enum ('tentative', 'confirmed', 'completed', 'canceled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  status public.model_status not null default 'draft',
  is_published boolean not null default false,
  categories text[] not null default '{}',
  gender text,
  nationality text,
  birth_date date,
  location text,
  bio text,
  main_image_path text,
  height_cm integer,
  bust_cm integer,
  waist_cm integer,
  hips_cm integer,
  shoe_size text,
  hair_color text,
  eye_color text,
  clothing_size text,
  tags text[] not null default '{}',
  notes text,
  consent_lgpd boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  company_type text,
  status text not null default 'lead',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.model_media (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  media_type public.media_type not null,
  storage_bucket text not null,
  storage_path text not null,
  title text,
  thumbnail_path text,
  status public.media_status not null default 'pending_review',
  visibility public.media_visibility not null default 'private',
  sort_order integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.availability_status not null,
  reason text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_valid_range check (end_at > start_at)
);

create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shortlist_models (
  shortlist_id uuid not null references public.shortlists(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shortlist_id, model_id)
);

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  shortlist_id uuid references public.shortlists(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  request_type text not null default 'booking',
  title text not null,
  brief text,
  requested_at timestamptz,
  location text,
  status public.request_status not null default 'new',
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_has_target check (shortlist_id is not null or model_id is not null)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  model_id uuid not null references public.models(id) on delete restrict,
  request_id uuid references public.client_requests(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  status public.booking_status not null default 'tentative',
  brief text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_models_updated_at
before update on public.models
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_model_media_updated_at
before update on public.model_media
for each row execute function public.set_updated_at();

create trigger set_availability_updated_at
before update on public.availability
for each row execute function public.set_updated_at();

create trigger set_shortlists_updated_at
before update on public.shortlists
for each row execute function public.set_updated_at();

create trigger set_client_requests_updated_at
before update on public.client_requests
for each row execute function public.set_updated_at();

create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.models enable row level security;
alter table public.clients enable row level security;
alter table public.model_media enable row level security;
alter table public.availability enable row level security;
alter table public.shortlists enable row level security;
alter table public.shortlist_models enable row level security;
alter table public.client_requests enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "profiles can read own profile"
on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "admins manage profiles"
on public.profiles for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "clients read published models"
on public.models for select
using (
  public.current_user_role() = 'admin'
  or user_id = auth.uid()
  or (status = 'approved' and is_published = true and public.current_user_role() = 'client')
);

create policy "admins manage models"
on public.models for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "clients read own client profile"
on public.clients for select
using (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "clients update own client profile"
on public.clients for update
using (user_id = auth.uid() or public.current_user_role() = 'admin')
with check (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "admins manage clients"
on public.clients for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

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

create policy "models insert own media"
on public.model_media for insert
with check (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.models m
    where m.id = model_media.model_id
      and m.user_id = auth.uid()
  )
);

create policy "admins manage media"
on public.model_media for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "availability read by model owner or admin"
on public.availability for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.models m
    where m.id = availability.model_id
      and m.user_id = auth.uid()
  )
);

create policy "models manage own manual availability"
on public.availability for all
using (
  public.current_user_role() = 'admin'
  or (
    source = 'manual'
    and exists (
      select 1
      from public.models m
      where m.id = availability.model_id
        and m.user_id = auth.uid()
    )
  )
)
with check (
  public.current_user_role() = 'admin'
  or (
    source = 'manual'
    and exists (
      select 1
      from public.models m
      where m.id = availability.model_id
        and m.user_id = auth.uid()
    )
  )
);

create policy "clients read own shortlists"
on public.shortlists for select
using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "clients manage own draft shortlists"
on public.shortlists for all
using (
  public.current_user_role() = 'admin'
  or (owner_id = auth.uid() and status = 'draft')
)
with check (
  public.current_user_role() = 'admin'
  or owner_id = auth.uid()
);

create policy "clients read own shortlist models"
on public.shortlist_models for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.shortlists s
    where s.id = shortlist_models.shortlist_id
      and s.owner_id = auth.uid()
  )
);

create policy "clients manage own draft shortlist models"
on public.shortlist_models for all
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.shortlists s
    where s.id = shortlist_models.shortlist_id
      and s.owner_id = auth.uid()
      and s.status = 'draft'
  )
)
with check (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.shortlists s
    where s.id = shortlist_models.shortlist_id
      and s.owner_id = auth.uid()
      and s.status = 'draft'
  )
);

create policy "clients read own requests"
on public.client_requests for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.clients c
    where c.id = client_requests.client_id
      and c.user_id = auth.uid()
  )
);

create policy "clients create own requests"
on public.client_requests for insert
with check (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.clients c
    where c.id = client_requests.client_id
      and c.user_id = auth.uid()
      and c.status <> 'blocked'
  )
);

create policy "admins manage requests"
on public.client_requests for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "bookings read by related model or admin"
on public.bookings for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.models m
    where m.id = bookings.model_id
      and m.user_id = auth.uid()
  )
);

create policy "admins manage bookings"
on public.bookings for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "admins read audit logs"
on public.audit_logs for select
using (public.current_user_role() = 'admin');

create policy "admins create audit logs"
on public.audit_logs for insert
with check (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public)
values
  ('model-portfolio', 'model-portfolio', false),
  ('model-polaroids', 'model-polaroids', false),
  ('model-videos', 'model-videos', false),
  ('model-documents', 'model-documents', false)
on conflict (id) do nothing;
