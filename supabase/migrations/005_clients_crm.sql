alter table public.clients
  add column if not exists client_type text not null default 'other',
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists general_email text,
  add column if not exists general_phone text,
  add column if not exists general_whatsapp text,
  add column if not exists general_wechat text,
  add column if not exists website text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists market_notes text,
  add column if not exists preferred_model_profile text,
  add column if not exists internal_notes text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.clients
  alter column status set default 'lead';

update public.clients
set general_email = email
where general_email is null
  and nullif(btrim(email), '') is not null;

update public.clients
set general_phone = phone
where general_phone is null
  and nullif(btrim(phone), '') is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_client_type_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_client_type_check
      check (
        client_type in (
          'international_agency',
          'brand',
          'production',
          'photographer',
          'casting_director',
          'partner',
          'other'
        )
      )
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_status_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_status_check
      check (
        status in (
          'lead',
          'active',
          'partner',
          'inactive',
          'do_not_contact'
        )
      )
      not valid;
  end if;
end;
$$;

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  is_primary boolean not null default false,
  can_receive_emails boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);

create table if not exists public.client_channels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid,
  channel_type text not null,
  value text,
  url text,
  label text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_channels_contact_client_fk
    foreign key (contact_id, client_id)
    references public.client_contacts(id, client_id)
    on delete cascade,
  constraint client_channels_type_check
    check (
      channel_type in (
        'instagram',
        'personal_instagram',
        'tiktok',
        'wechat',
        'rednote',
        'linkedin',
        'facebook',
        'telegram',
        'line',
        'kakao_talk',
        'whatsapp',
        'website',
        'email',
        'phone',
        'other'
      )
    ),
  constraint client_channels_value_or_url_check
    check (
      nullif(btrim(value), '') is not null
      or nullif(btrim(url), '') is not null
    )
);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_client_contacts_updated_at'
      and tgrelid = 'public.client_contacts'::regclass
  ) then
    create trigger set_client_contacts_updated_at
    before update on public.client_contacts
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_client_channels_updated_at'
      and tgrelid = 'public.client_channels'::regclass
  ) then
    create trigger set_client_channels_updated_at
    before update on public.client_channels
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.client_contacts enable row level security;
alter table public.client_channels enable row level security;

drop policy if exists "admins manage client contacts" on public.client_contacts;
create policy "admins manage client contacts"
on public.client_contacts for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage client channels" on public.client_channels;
create policy "admins manage client channels"
on public.client_channels for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create index if not exists clients_country_idx
on public.clients (country);

create index if not exists clients_city_idx
on public.clients (city);

create index if not exists clients_status_idx
on public.clients (status);

create index if not exists clients_client_type_idx
on public.clients (client_type);

create index if not exists clients_tags_idx
on public.clients using gin (tags);

create index if not exists client_contacts_client_id_idx
on public.client_contacts (client_id);

create index if not exists client_contacts_email_idx
on public.client_contacts (email)
where email is not null;

create index if not exists client_contacts_can_receive_emails_idx
on public.client_contacts (can_receive_emails);

create index if not exists client_channels_client_id_idx
on public.client_channels (client_id);

create index if not exists client_channels_contact_id_idx
on public.client_channels (contact_id);

create index if not exists client_channels_channel_type_idx
on public.client_channels (channel_type);
