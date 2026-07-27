create table if not exists public.google_workspace_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  connected_email text not null,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  last_used_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_workspace_connections_status_check check (
    status in ('connected', 'disconnected', 'revoked', 'error')
  ),
  constraint google_workspace_connections_email_check check (connected_email = lower(connected_email))
);

create unique index if not exists google_workspace_connections_profile_unique
on public.google_workspace_connections (profile_id);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  language text not null default 'pt-BR',
  subject text not null,
  body_html text not null,
  body_text text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_templates_language_check check (language in ('pt-BR', 'en')),
  constraint email_templates_category_check check (
    category in (
      'model_presentation',
      'casting_selection',
      'shortlist',
      'direct_booking',
      'international_placement',
      'material_update',
      'profile_update_full',
      'measurements_update',
      'polaroids_update',
      'videos_update',
      'documents_update',
      'reminder',
      'update_completed',
      'follow_up',
      'custom'
    )
  )
);

create index if not exists email_templates_category_language_idx
on public.email_templates (category, language, is_active);

create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  agency_id uuid references public.partner_agencies(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  purpose text,
  language text not null default 'pt-BR',
  status text not null default 'draft',
  public_token_hash text not null unique,
  password_hash text,
  expires_at timestamptz,
  allow_downloads boolean not null default false,
  appearance jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  version_number integer not null default 1,
  published_at timestamptz,
  revoked_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presentations_language_check check (language in ('pt-BR', 'en')),
  constraint presentations_status_check check (
    status in ('draft', 'published', 'sent', 'expired', 'revoked', 'archived')
  )
);

create index if not exists presentations_status_idx on public.presentations (status, created_at desc);

create table if not exists public.presentation_models (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  position integer not null default 0,
  model_snapshot jsonb not null default '{}'::jsonb,
  include_measurements boolean not null default true,
  include_location boolean not null default true,
  include_social_links boolean not null default true,
  created_at timestamptz not null default now(),
  unique (presentation_id, model_id)
);

create index if not exists presentation_models_presentation_idx
on public.presentation_models (presentation_id, position);

create table if not exists public.presentation_model_media (
  id uuid primary key default gen_random_uuid(),
  presentation_model_id uuid not null references public.presentation_models(id) on delete cascade,
  model_media_id uuid references public.model_media(id) on delete set null,
  media_snapshot jsonb not null default '{}'::jsonb,
  media_type text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.presentation_versions (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (presentation_id, version_number)
);

create table if not exists public.presentation_recipients (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  recipient_name text,
  recipient_email text not null,
  outbound_email_id uuid,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.presentation_access_events (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  sender_connection_id uuid references public.google_workspace_connections(id) on delete set null,
  recipient_name text,
  recipient_email text not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  status text not null default 'draft',
  mode text not null default 'system_draft',
  scheduled_at timestamptz,
  gmail_message_id text,
  gmail_thread_id text,
  gmail_draft_id text,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message_sanitized text,
  presentation_id uuid references public.presentations(id) on delete set null,
  model_update_request_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_emails_status_check check (
    status in ('draft', 'scheduled', 'queued', 'processing', 'sent', 'failed', 'canceled', 'retry_pending')
  ),
  constraint outbound_emails_mode_check check (
    mode in ('system_draft', 'gmail_draft', 'send_now', 'scheduled')
  ),
  constraint outbound_emails_attempt_check check (attempt_count >= 0)
);

create unique index if not exists outbound_emails_idempotency_unique
on public.outbound_emails (idempotency_key);

create index if not exists outbound_emails_status_idx
on public.outbound_emails (status, scheduled_at, created_at);

create table if not exists public.model_update_requests (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  title text not null,
  message text,
  language text not null default 'pt-BR',
  status text not null default 'draft',
  public_token_hash text not null unique,
  verification_required boolean not null default false,
  expires_at timestamptz not null,
  due_at timestamptz,
  auto_apply_safe_fields boolean not null default true,
  sent_at timestamptz,
  opened_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  applied_at timestamptz,
  canceled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_update_requests_language_check check (language in ('pt-BR', 'en')),
  constraint model_update_requests_status_check check (
    status in (
      'draft',
      'ready',
      'sent',
      'delivered',
      'opened',
      'started',
      'partially_completed',
      'submitted',
      'applied',
      'review_required',
      'expired',
      'canceled'
    )
  )
);

create index if not exists model_update_requests_model_idx
on public.model_update_requests (model_id, created_at desc);

alter table public.model_update_requests
  add column if not exists title text,
  add column if not exists language text not null default 'pt-BR',
  add column if not exists public_token_hash text,
  add column if not exists verification_required boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists auto_apply_safe_fields boolean not null default true,
  add column if not exists opened_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.model_update_requests
set
  title = coalesce(title, 'Atualização de perfil ARO'),
  expires_at = coalesce(expires_at, sent_at + interval '30 days', now() + interval '30 days'),
  public_token_hash = coalesce(
    public_token_hash,
    encode(digest(id::text || clock_timestamp()::text || gen_random_uuid()::text, 'sha256'), 'hex')
  )
where title is null
   or expires_at is null
   or public_token_hash is null;

alter table public.model_update_requests
  alter column title set not null,
  alter column expires_at set not null,
  alter column public_token_hash set not null;

create unique index if not exists model_update_requests_public_token_hash_unique
on public.model_update_requests (public_token_hash);

create table if not exists public.model_update_request_fields (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.model_update_requests(id) on delete cascade,
  field_key text not null,
  field_group text not null,
  is_required boolean not null default false,
  is_sensitive boolean not null default false,
  allow_auto_apply boolean not null default false,
  position integer not null default 0,
  unique (request_id, field_key)
);

create table if not exists public.model_update_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.model_update_requests(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  status text not null default 'draft',
  draft_payload jsonb not null default '{}'::jsonb,
  submitted_payload jsonb,
  previous_snapshot jsonb,
  applied_snapshot jsonb,
  submitted_at timestamptz,
  applied_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_update_submissions_status_check check (
    status in ('draft', 'submitted', 'applied', 'review_required', 'rejected')
  )
);

create unique index if not exists model_update_submissions_request_unique
on public.model_update_submissions (request_id);

create table if not exists public.model_update_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.model_update_submissions(id) on delete cascade,
  media_type text not null,
  bucket text not null,
  object_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text,
  status text not null default 'pending_review',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint model_update_files_status_check check (
    status in ('pending_review', 'approved', 'rejected', 'archived')
  ),
  constraint model_update_files_size_check check (size_bytes >= 0)
);

create table if not exists public.model_update_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.model_update_requests(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  event_type text not null,
  previous_snapshot jsonb,
  new_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.model_update_reminders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.model_update_requests(id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'scheduled',
  sent_at timestamptz,
  outbound_email_id uuid references public.outbound_emails(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint model_update_reminders_status_check check (
    status in ('scheduled', 'sent', 'skipped', 'failed', 'canceled')
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'google_workspace_connections',
    'email_templates',
    'presentations',
    'presentation_models',
    'presentation_model_media',
    'presentation_versions',
    'presentation_recipients',
    'presentation_access_events',
    'outbound_emails',
    'model_update_requests',
    'model_update_request_fields',
    'model_update_submissions',
    'model_update_files',
    'model_update_audit_events',
    'model_update_reminders'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'google_workspace_connections',
    'email_templates',
    'presentations',
    'presentation_models',
    'presentation_model_media',
    'presentation_versions',
    'presentation_recipients',
    'presentation_access_events',
    'outbound_emails',
    'model_update_requests',
    'model_update_request_fields',
    'model_update_submissions',
    'model_update_files',
    'model_update_audit_events',
    'model_update_reminders'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'admins manage ' || table_name
    ) then
      execute format(
        'create policy %L on public.%I for all using (public.current_user_role() = %L) with check (public.current_user_role() = %L)',
        'admins manage ' || table_name,
        table_name,
        'admin',
        'admin'
      );
    end if;
  end loop;
end $$;

insert into public.email_templates (
  name,
  category,
  language,
  subject,
  body_html,
  body_text,
  is_default,
  is_active
)
values
  (
    'Solicitação de atualização completa',
    'profile_update_full',
    'pt-BR',
    'ARO — Atualização do seu perfil',
    '<p>Olá, {{model_name}}.</p><p>Precisamos atualizar algumas informações e materiais do seu perfil na ARO.</p><p><a href="{{update_url}}">Atualizar meu perfil</a></p><p>A solicitação ficará disponível até {{due_date}}.</p><p>Caso tenha qualquer dúvida, basta responder a este e-mail.</p><p>Claudio Mignoni<br>ARO</p>',
    'Olá, {{model_name}}.\n\nPrecisamos atualizar algumas informações e materiais do seu perfil na ARO.\n\nAtualizar meu perfil: {{update_url}}\n\nA solicitação ficará disponível até {{due_date}}.\n\nCaso tenha qualquer dúvida, basta responder a este e-mail.\n\nClaudio Mignoni\nARO',
    true,
    true
  ),
  (
    'Profile update request',
    'profile_update_full',
    'en',
    'ARO — Profile update request',
    '<p>Hi {{model_name}},</p><p>We need to update some information and materials in your ARO profile.</p><p><a href="{{update_url}}">Update my profile</a></p><p>This request will remain available until {{due_date}}.</p><p>If you have any questions, simply reply to this email.</p><p>Claudio Mignoni<br>ARO</p>',
    'Hi {{model_name}},\n\nWe need to update some information and materials in your ARO profile.\n\nUpdate my profile: {{update_url}}\n\nThis request will remain available until {{due_date}}.\n\nIf you have any questions, simply reply to this email.\n\nClaudio Mignoni\nARO',
    true,
    true
  ),
  (
    'Apresentação de modelos',
    'model_presentation',
    'pt-BR',
    'ARO — Apresentação de modelos',
    '<p>Olá, {{recipient_name}}.</p><p>Compartilho uma seleção de modelos ARO preparada para você.</p><p><a href="{{presentation_url}}">Ver apresentação</a></p><p>Claudio Mignoni<br>Director / Model Manager<br>ARO<br>claudio@arolab.co<br>www.arolab.co</p>',
    'Olá, {{recipient_name}}.\n\nCompartilho uma seleção de modelos ARO preparada para você.\n\nVer apresentação: {{presentation_url}}\n\nClaudio Mignoni\nDirector / Model Manager\nARO\nclaudio@arolab.co\nwww.arolab.co',
    true,
    true
  )
on conflict do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'presentation_recipients_outbound_email_fk'
      and conrelid = 'public.presentation_recipients'::regclass
  ) then
    alter table public.presentation_recipients
      add constraint presentation_recipients_outbound_email_fk
      foreign key (outbound_email_id) references public.outbound_emails(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'outbound_emails_model_update_request_fk'
      and conrelid = 'public.outbound_emails'::regclass
  ) then
    alter table public.outbound_emails
      add constraint outbound_emails_model_update_request_fk
      foreign key (model_update_request_id) references public.model_update_requests(id) on delete set null;
  end if;
end $$;

create index if not exists presentations_public_token_hash_idx
on public.presentations (public_token_hash);

create index if not exists presentations_public_status_expires_idx
on public.presentations (status, expires_at, revoked_at);

create index if not exists presentation_recipients_email_idx
on public.presentation_recipients (recipient_email);

create index if not exists presentation_access_events_presentation_idx
on public.presentation_access_events (presentation_id, occurred_at desc);

create index if not exists outbound_emails_recipient_email_idx
on public.outbound_emails (recipient_email);

create index if not exists outbound_emails_update_request_idx
on public.outbound_emails (model_update_request_id);

create index if not exists model_update_requests_public_token_hash_idx
on public.model_update_requests (public_token_hash);

create index if not exists model_update_requests_status_due_idx
on public.model_update_requests (status, due_at, expires_at);

create index if not exists model_update_request_fields_request_idx
on public.model_update_request_fields (request_id, position);

create index if not exists model_update_reminders_status_remind_at_idx
on public.model_update_reminders (status, remind_at);

create index if not exists model_update_audit_events_request_idx
on public.model_update_audit_events (request_id, created_at desc);

drop trigger if exists set_google_workspace_connections_updated_at on public.google_workspace_connections;
create trigger set_google_workspace_connections_updated_at
before update on public.google_workspace_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_presentations_updated_at on public.presentations;
create trigger set_presentations_updated_at
before update on public.presentations
for each row execute function public.set_updated_at();

drop trigger if exists set_outbound_emails_updated_at on public.outbound_emails;
create trigger set_outbound_emails_updated_at
before update on public.outbound_emails
for each row execute function public.set_updated_at();

drop trigger if exists set_model_update_requests_updated_at on public.model_update_requests;
create trigger set_model_update_requests_updated_at
before update on public.model_update_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_model_update_submissions_updated_at on public.model_update_submissions;
create trigger set_model_update_submissions_updated_at
before update on public.model_update_submissions
for each row execute function public.set_updated_at();

create or replace function public.get_public_presentation_by_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'title', p.title,
    'description', p.description,
    'language', p.language,
    'allow_downloads', p.allow_downloads,
    'published_at', p.published_at,
    'snapshot', coalesce(nullif(p.snapshot, '{}'::jsonb), pv.snapshot, '{}'::jsonb)
  )
  into payload
  from public.presentations p
  left join lateral (
    select snapshot
    from public.presentation_versions
    where presentation_id = p.id
    order by version_number desc
    limit 1
  ) pv on true
  where p.public_token_hash = p_token_hash
    and p.status in ('published', 'sent')
    and p.revoked_at is null
    and p.archived_at is null
    and (p.expires_at is null or p.expires_at > now())
  limit 1;

  return payload;
end;
$$;

create or replace function public.mark_public_presentation_opened(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  presentation_uuid uuid;
begin
  select id into presentation_uuid
  from public.presentations
  where public_token_hash = p_token_hash
    and status in ('published', 'sent')
    and revoked_at is null
    and archived_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if presentation_uuid is null then
    return false;
  end if;

  insert into public.presentation_access_events (presentation_id, event_type, metadata)
  values (presentation_uuid, 'opened', jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

create or replace function public.get_public_model_update_request_by_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'title', r.title,
    'message', r.message,
    'language', r.language,
    'due_at', r.due_at,
    'expires_at', r.expires_at,
    'status', r.status,
    'verification_required', r.verification_required,
    'model', jsonb_build_object(
      'display_name', m.display_name,
      'stage_name', m.stage_name,
      'main_image_path', m.main_image_path
    ),
    'fields', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'field_key', f.field_key,
          'field_group', f.field_group,
          'is_required', f.is_required,
          'is_sensitive', f.is_sensitive
        )
        order by f.position, f.field_key
      ) filter (where f.id is not null),
      '[]'::jsonb
    ),
    'draft_payload', coalesce(s.draft_payload, '{}'::jsonb),
    'submitted_at', s.submitted_at
  )
  into payload
  from public.model_update_requests r
  join public.models m on m.id = r.model_id
  left join public.model_update_request_fields f on f.request_id = r.id
  left join public.model_update_submissions s on s.request_id = r.id
  where r.public_token_hash = p_token_hash
    and r.status not in ('expired', 'canceled', 'applied')
    and r.expires_at > now()
  group by r.id, m.id, s.id
  limit 1;

  return payload;
end;
$$;

create or replace function public.mark_model_update_request_opened(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_uuid uuid;
  model_uuid uuid;
begin
  select id, model_id into request_uuid, model_uuid
  from public.model_update_requests
  where public_token_hash = p_token_hash
    and status not in ('expired', 'canceled', 'applied')
    and expires_at > now()
  limit 1;

  if request_uuid is null then
    return false;
  end if;

  update public.model_update_requests
  set opened_at = coalesce(opened_at, now()),
      status = case when status in ('ready', 'sent', 'delivered') then 'opened' else status end
  where id = request_uuid;

  insert into public.model_update_audit_events (request_id, model_id, event_type, metadata)
  values (request_uuid, model_uuid, 'opened', jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

create or replace function public.start_model_update_request(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_uuid uuid;
  model_uuid uuid;
begin
  select id, model_id into request_uuid, model_uuid
  from public.model_update_requests
  where public_token_hash = p_token_hash
    and status not in ('expired', 'canceled', 'applied')
    and expires_at > now()
  limit 1;

  if request_uuid is null then
    return false;
  end if;

  update public.model_update_requests
  set started_at = coalesce(started_at, now()),
      status = case when status in ('ready', 'sent', 'delivered', 'opened') then 'started' else status end
  where id = request_uuid;

  insert into public.model_update_submissions (request_id, model_id, status)
  values (request_uuid, model_uuid, 'draft')
  on conflict (request_id) do nothing;

  insert into public.model_update_audit_events (request_id, model_id, event_type, metadata)
  values (request_uuid, model_uuid, 'started', jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

create or replace function public.save_model_update_request_draft(p_token_hash text, draft jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_uuid uuid;
  model_uuid uuid;
begin
  select id, model_id into request_uuid, model_uuid
  from public.model_update_requests
  where public_token_hash = p_token_hash
    and status not in ('expired', 'canceled', 'applied', 'submitted', 'review_required')
    and expires_at > now()
  limit 1;

  if request_uuid is null then
    return false;
  end if;

  insert into public.model_update_submissions (request_id, model_id, status, draft_payload)
  values (request_uuid, model_uuid, 'draft', coalesce(draft, '{}'::jsonb))
  on conflict (request_id)
  do update set draft_payload = excluded.draft_payload, status = 'draft', updated_at = now();

  update public.model_update_requests
  set status = 'partially_completed'
  where id = request_uuid
    and status in ('ready', 'sent', 'delivered', 'opened', 'started');

  insert into public.model_update_audit_events (request_id, model_id, event_type, new_snapshot, metadata)
  values (request_uuid, model_uuid, 'draft_saved', coalesce(draft, '{}'::jsonb), jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

create or replace function public.submit_model_update_request(p_token_hash text, submission jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_uuid uuid;
  model_uuid uuid;
begin
  select id, model_id into request_uuid, model_uuid
  from public.model_update_requests
  where public_token_hash = p_token_hash
    and status not in ('expired', 'canceled', 'applied', 'submitted', 'review_required')
    and expires_at > now()
  limit 1;

  if request_uuid is null then
    return false;
  end if;

  insert into public.model_update_submissions (
    request_id,
    model_id,
    status,
    draft_payload,
    submitted_payload,
    submitted_at
  )
  values (
    request_uuid,
    model_uuid,
    'submitted',
    coalesce(submission, '{}'::jsonb),
    coalesce(submission, '{}'::jsonb),
    now()
  )
  on conflict (request_id)
  do update set
    status = 'submitted',
    draft_payload = excluded.draft_payload,
    submitted_payload = excluded.submitted_payload,
    submitted_at = now(),
    updated_at = now();

  update public.model_update_requests
  set status = 'submitted',
      submitted_at = now()
  where id = request_uuid;

  insert into public.model_update_audit_events (request_id, model_id, event_type, new_snapshot, metadata)
  values (request_uuid, model_uuid, 'submitted', coalesce(submission, '{}'::jsonb), jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

revoke all on function public.get_public_presentation_by_token(text) from public;
revoke all on function public.mark_public_presentation_opened(text) from public;
revoke all on function public.get_public_model_update_request_by_token(text) from public;
revoke all on function public.mark_model_update_request_opened(text) from public;
revoke all on function public.start_model_update_request(text) from public;
revoke all on function public.save_model_update_request_draft(text, jsonb) from public;
revoke all on function public.submit_model_update_request(text, jsonb) from public;

grant execute on function public.get_public_presentation_by_token(text) to anon, authenticated;
grant execute on function public.mark_public_presentation_opened(text) to anon, authenticated;
grant execute on function public.get_public_model_update_request_by_token(text) to anon, authenticated;
grant execute on function public.mark_model_update_request_opened(text) to anon, authenticated;
grant execute on function public.start_model_update_request(text) to anon, authenticated;
grant execute on function public.save_model_update_request_draft(text, jsonb) to anon, authenticated;
grant execute on function public.submit_model_update_request(text, jsonb) to anon, authenticated;
