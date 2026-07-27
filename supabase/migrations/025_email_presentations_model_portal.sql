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

create table if not exists public.presentation_share_links (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  presentation_version_id uuid references public.presentation_versions(id) on delete set null,
  recipient_id uuid references public.presentation_recipients(id) on delete set null,
  public_token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
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
  scheduled_timezone text,
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
  presentation_share_link_id uuid references public.presentation_share_links(id) on delete set null,
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

alter table public.outbound_emails
  add column if not exists scheduled_timezone text,
  add column if not exists presentation_share_link_id uuid references public.presentation_share_links(id) on delete set null;

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
    status in ('uploading', 'validating', 'pending_review', 'approved', 'rejected', 'archived')
  ),
  constraint model_update_files_size_check check (size_bytes >= 0)
);

do $$
begin
  alter table public.model_update_files
    drop constraint if exists model_update_files_status_check;

  alter table public.model_update_files
    add constraint model_update_files_status_check check (
      status in ('uploading', 'validating', 'pending_review', 'approved', 'rejected', 'archived')
    );
end $$;

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
    status in ('scheduled', 'queued', 'processing', 'sent', 'skipped', 'failed', 'canceled')
  )
);

create table if not exists public.model_update_verification_codes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.model_update_requests(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint model_update_verification_codes_attempt_check check (attempt_count >= 0)
);

create table if not exists public.communication_rate_limits (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  ip_hash text not null,
  operation text not null,
  window_start timestamptz not null,
  attempt_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token_hash, ip_hash, operation, window_start),
  constraint communication_rate_limits_attempt_check check (attempt_count >= 0)
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
    'presentation_share_links',
    'presentation_access_events',
    'outbound_emails',
    'model_update_requests',
    'model_update_request_fields',
    'model_update_submissions',
    'model_update_files',
    'model_update_audit_events',
    'model_update_reminders',
    'model_update_verification_codes',
    'communication_rate_limits'
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
    'presentation_share_links',
    'presentation_access_events',
    'outbound_emails',
    'model_update_requests',
    'model_update_request_fields',
    'model_update_submissions',
    'model_update_files',
    'model_update_audit_events',
    'model_update_reminders',
    'model_update_verification_codes',
    'communication_rate_limits'
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

create index if not exists presentation_share_links_token_idx
on public.presentation_share_links (public_token_hash);

create index if not exists presentation_share_links_presentation_idx
on public.presentation_share_links (presentation_id, created_at desc);

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

create index if not exists model_update_files_submission_idx
on public.model_update_files (submission_id, created_at desc);

create index if not exists model_update_verification_codes_request_idx
on public.model_update_verification_codes (request_id, expires_at desc);

create index if not exists communication_rate_limits_lookup_idx
on public.communication_rate_limits (token_hash, ip_hash, operation, window_start);

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
  presentation_record record;
  snapshot_source jsonb;
begin
  select
    p.title,
    p.description,
    p.language,
    p.allow_downloads,
    p.published_at,
    coalesce(nullif(pv.snapshot, '{}'::jsonb), nullif(p.snapshot, '{}'::jsonb), '{}'::jsonb) as snapshot
  into presentation_record
  from public.presentation_share_links sl
  join public.presentations p on p.id = sl.presentation_id
  left join public.presentation_versions pv on pv.id = sl.presentation_version_id
  where sl.public_token_hash = p_token_hash
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.status in ('published', 'sent')
    and p.revoked_at is null
    and p.archived_at is null
    and (p.expires_at is null or p.expires_at > now())
  limit 1;

  if not found then
    select
      p.title,
      p.description,
      p.language,
      p.allow_downloads,
      p.published_at,
      coalesce(nullif(p.snapshot, '{}'::jsonb), nullif(pv.snapshot, '{}'::jsonb), '{}'::jsonb) as snapshot
    into presentation_record
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
  end if;

  if not found then
    return null;
  end if;

  snapshot_source := coalesce(presentation_record.snapshot, '{}'::jsonb);

  select jsonb_build_object(
    'title', presentation_record.title,
    'description', presentation_record.description,
    'language', presentation_record.language,
    'allow_downloads', presentation_record.allow_downloads,
    'published_at', presentation_record.published_at,
    'snapshot', jsonb_build_object(
      'title', snapshot_source->'title',
      'description', snapshot_source->'description',
      'contact', snapshot_source->'contact',
      'models', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'public_model_key', model_item.value->'public_model_key',
            'board', model_item.value->'board',
            'city', model_item.value->'city',
            'country', model_item.value->'country',
            'display_name', model_item.value->'display_name',
            'highlighted', model_item.value->'highlighted',
            'measurements', model_item.value->'measurements',
            'media', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'public_media_key', media_item.value->'public_media_key',
                  'media_type', media_item.value->'media_type',
                  'title', media_item.value->'title'
                )
                order by media_item.ordinality
              )
              from jsonb_array_elements(coalesce(model_item.value->'media', '[]'::jsonb)) with ordinality media_item(value, ordinality)
            ), '[]'::jsonb)
          )
          order by model_item.ordinality
        )
        from jsonb_array_elements(coalesce(snapshot_source->'models', '[]'::jsonb)) with ordinality model_item(value, ordinality)
      ), '[]'::jsonb)
    )
  )
  into payload;

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
  recipient_uuid uuid;
  share_link_uuid uuid;
begin
  select p.id, sl.id, sl.recipient_id into presentation_uuid, share_link_uuid, recipient_uuid
  from public.presentation_share_links sl
  join public.presentations p on p.id = sl.presentation_id
  where sl.public_token_hash = p_token_hash
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.status in ('published', 'sent')
    and p.revoked_at is null
    and p.archived_at is null
    and (p.expires_at is null or p.expires_at > now())
  limit 1;

  if presentation_uuid is null then
    select id into presentation_uuid
    from public.presentations
    where public_token_hash = p_token_hash
      and status in ('published', 'sent')
      and revoked_at is null
      and archived_at is null
      and (expires_at is null or expires_at > now())
    limit 1;
  end if;

  if presentation_uuid is null then
    return false;
  end if;

  insert into public.presentation_access_events (presentation_id, event_type, metadata)
  values (
    presentation_uuid,
    'opened',
    jsonb_build_object(
      'source', 'public_link',
      'share_link_id', share_link_uuid,
      'recipient_id', recipient_uuid
    )
  );

  if recipient_uuid is not null then
    update public.presentation_recipients
    set opened_at = coalesce(opened_at, now())
    where id = recipient_uuid;
  end if;

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

create or replace function public.check_communication_rate_limit(
  p_token_hash text,
  p_ip_hash text,
  p_operation text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_token_hash is null or p_ip_hash is null or p_operation is null then
    return false;
  end if;

  current_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.communication_rate_limits (
    token_hash,
    ip_hash,
    operation,
    window_start,
    attempt_count
  )
  values (
    p_token_hash,
    p_ip_hash,
    p_operation,
    current_window,
    1
  )
  on conflict (token_hash, ip_hash, operation, window_start)
  do update set
    attempt_count = public.communication_rate_limits.attempt_count + 1,
    updated_at = now()
  returning attempt_count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.verify_model_update_code(
  p_token_hash text,
  p_submitted_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  code_record record;
  accepted boolean := false;
begin
  select vc.id, vc.code_hash, vc.attempt_count, vc.expires_at
    into code_record
  from public.model_update_verification_codes vc
  join public.model_update_requests r on r.id = vc.request_id
  where r.public_token_hash = p_token_hash
    and r.status not in ('expired', 'canceled', 'applied')
    and r.expires_at > now()
    and vc.verified_at is null
    and vc.consumed_at is null
  order by vc.requested_at desc
  for update of vc
  limit 1;

  if not found then
    return false;
  end if;

  if code_record.attempt_count >= 5 then
    return false;
  end if;

  accepted := code_record.code_hash = p_submitted_code_hash
    and code_record.expires_at > now();

  update public.model_update_verification_codes
  set
    attempt_count = attempt_count + 1,
    verified_at = case when accepted then now() else verified_at end
  where id = code_record.id;

  return accepted;
end;
$$;

create or replace function public.sanitize_model_update_payload(
  p_request_id uuid,
  p_payload jsonb,
  p_sensitive_verified boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sanitized jsonb := '{}'::jsonb;
  key_name text;
  value_json jsonb;
  field_record record;
  allowed_keys text[];
  payload_text text;
begin
  if p_payload is null then
    return '{}'::jsonb;
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload_type';
  end if;

  if (select count(*) from jsonb_object_keys(p_payload)) > 30 then
    raise exception 'payload_has_too_many_keys';
  end if;

  payload_text := p_payload::text;
  if length(payload_text) > 20000 then
    raise exception 'payload_too_large';
  end if;

  select array_agg(field_key)
    into allowed_keys
  from public.model_update_request_fields
  where request_id = p_request_id;

  if allowed_keys is null then
    allowed_keys := array[]::text[];
  end if;

  if 'measurements' = any(allowed_keys) then
    allowed_keys := allowed_keys || array[
      'height_cm',
      'bust_cm',
      'waist_cm',
      'hips_cm',
      'shoe_size',
      'shoe_size_br',
      'dress_size_br'
    ];
  end if;

  for key_name, value_json in
    select key, value
    from jsonb_each(p_payload)
  loop
    if key_name in (
      'id',
      'model_id',
      'request_id',
      'public_token_hash',
      'token',
      'status',
      'created_by',
      'updated_by',
      'reviewed_by',
      'admin',
      'permissions'
    ) then
      raise exception 'administrative_field_not_allowed';
    end if;

    if not (key_name = any(allowed_keys)) then
      raise exception 'field_not_requested';
    end if;

    select *
      into field_record
    from public.model_update_request_fields
    where request_id = p_request_id
      and field_key = key_name
    limit 1;

    if not found and key_name in (
      'height_cm',
      'bust_cm',
      'waist_cm',
      'hips_cm',
      'shoe_size',
      'shoe_size_br',
      'dress_size_br'
    ) then
      select *
        into field_record
      from public.model_update_request_fields
      where request_id = p_request_id
        and field_key = 'measurements'
      limit 1;
    end if;

    if field_record.is_sensitive and not p_sensitive_verified then
      raise exception 'sensitive_field_requires_verification';
    end if;

    if jsonb_typeof(value_json) not in ('string', 'number', 'boolean', 'array') then
      raise exception 'invalid_field_value_type';
    end if;

    if length(value_json::text) > 4000 then
      raise exception 'field_value_too_large';
    end if;

    sanitized := sanitized || jsonb_build_object(
      key_name,
      case
        when jsonb_typeof(value_json) = 'string' then
          to_jsonb(
            left(
              regexp_replace(
                trim(both '"' from value_json::text),
                '<[^>]*>|javascript:|data:text/html|on[a-z]+\s*=',
                '',
                'gi'
              ),
              1000
            )
          )
        else value_json
      end
    );
  end loop;

  return sanitized;
end;
$$;

create or replace function public.update_presentation_draft(
  p_presentation_id uuid,
  p_admin_id uuid,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  model_item jsonb;
  media_item jsonb;
  presentation_model_uuid uuid;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'admin_required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_presentation_payload';
  end if;

  update public.presentations
  set
    allow_downloads = coalesce((p_payload->>'allow_downloads')::boolean, false),
    client_id = nullif(p_payload->>'client_id', '')::uuid,
    description = nullif(p_payload->>'description', ''),
    expires_at = nullif(p_payload->>'expires_at', '')::timestamptz,
    agency_id = nullif(p_payload->>'agency_id', '')::uuid,
    job_id = nullif(p_payload->>'job_id', '')::uuid,
    language = coalesce(nullif(p_payload->>'language', ''), 'pt-BR'),
    purpose = nullif(p_payload->>'purpose', ''),
    title = nullif(p_payload->>'title', ''),
    updated_by = p_admin_id
  where id = p_presentation_id
    and status in ('draft', 'published');

  if not found then
    raise exception 'presentation_not_editable';
  end if;

  delete from public.presentation_model_media pmm
  using public.presentation_models pm
  where pmm.presentation_model_id = pm.id
    and pm.presentation_id = p_presentation_id;

  delete from public.presentation_models
  where presentation_id = p_presentation_id;

  for model_item in
    select value
    from jsonb_array_elements(coalesce(p_payload->'models', '[]'::jsonb))
  loop
    insert into public.presentation_models (
      include_location,
      include_measurements,
      include_social_links,
      model_id,
      model_snapshot,
      position,
      presentation_id
    )
    values (
      coalesce((model_item->>'include_location')::boolean, true),
      coalesce((model_item->>'include_measurements')::boolean, true),
      coalesce((model_item->>'include_social_links')::boolean, true),
      (model_item->>'model_id')::uuid,
      jsonb_build_object('highlighted', coalesce((model_item->>'highlighted')::boolean, false)),
      coalesce((model_item->>'position')::integer, 0),
      p_presentation_id
    )
    returning id into presentation_model_uuid;

    for media_item in
      select value
      from jsonb_array_elements(coalesce(model_item->'media', '[]'::jsonb))
    loop
      insert into public.presentation_model_media (
        media_snapshot,
        media_type,
        model_media_id,
        position,
        presentation_model_id
      )
      values (
        jsonb_build_object('source', 'admin_selection'),
        coalesce(nullif(media_item->>'media_type', ''), 'portfolio'),
        (media_item->>'media_id')::uuid,
        coalesce((media_item->>'position')::integer, 0),
        presentation_model_uuid
      );
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.publish_presentation_snapshot(
  p_presentation_id uuid,
  p_admin_id uuid,
  p_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'admin_required';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'invalid_presentation_snapshot';
  end if;

  select version_number + 1
    into next_version
  from public.presentations
  where id = p_presentation_id
  for update;

  if next_version is null then
    raise exception 'presentation_not_found';
  end if;

  update public.presentations
  set
    published_at = now(),
    revoked_at = null,
    snapshot = p_snapshot,
    status = 'published',
    updated_by = p_admin_id,
    version_number = next_version
  where id = p_presentation_id;

  insert into public.presentation_versions (
    created_by,
    presentation_id,
    snapshot,
    version_number
  )
  values (
    p_admin_id,
    p_presentation_id,
    p_snapshot,
    next_version
  );

  return next_version;
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
  safe_draft jsonb;
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

  safe_draft := public.sanitize_model_update_payload(request_uuid, draft, false);

  insert into public.model_update_submissions (request_id, model_id, status, draft_payload)
  values (request_uuid, model_uuid, 'draft', safe_draft)
  on conflict (request_id)
  do update set draft_payload = excluded.draft_payload, updated_at = now();

  update public.model_update_requests
  set status = 'partially_completed'
  where id = request_uuid
    and status in ('ready', 'sent', 'delivered', 'opened', 'started');

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
  safe_submission jsonb;
  sensitive_verified boolean;
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

  select exists (
    select 1
    from public.model_update_verification_codes
    where request_id = request_uuid
      and model_id = model_uuid
      and verified_at is not null
      and consumed_at is null
      and expires_at > now()
  )
  into sensitive_verified;

  safe_submission := public.sanitize_model_update_payload(request_uuid, submission, sensitive_verified);

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
    safe_submission,
    safe_submission,
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

  update public.model_update_verification_codes
  set consumed_at = now()
  where request_id = request_uuid
    and model_id = model_uuid
    and verified_at is not null
    and consumed_at is null;

  insert into public.model_update_audit_events (request_id, model_id, event_type, new_snapshot, metadata)
  values (request_uuid, model_uuid, 'submitted', safe_submission, jsonb_build_object('source', 'public_link'));

  return true;
end;
$$;

create or replace function public.apply_model_update_submission(
  p_request_id uuid,
  p_selected_fields text[] default array[]::text[],
  p_approved_file_ids uuid[] default array[]::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record record;
  submission_record record;
  payload jsonb;
  selected_safe text[];
  previous_model jsonb;
  new_model jsonb;
  approved_file record;
  applied_field_names text[] := array[]::text[];
  approved_file_ids uuid[] := array[]::uuid[];
  contact_text text;
  location_text text;
  location_city text;
  location_country text;
  email_candidate text;
  phone_candidate text;
  current_time timestamptz := now();
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'admin_required';
  end if;

  select *
    into request_record
  from public.model_update_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;

  select *
    into submission_record
  from public.model_update_submissions
  where request_id = p_request_id
    and status = 'submitted'
    and submitted_payload is not null
  for update;

  if not found then
    raise exception 'submitted_payload_not_found';
  end if;

  payload := coalesce(submission_record.submitted_payload, '{}'::jsonb);

  select coalesce(array_agg(distinct selected_field), array[]::text[])
    into selected_safe
  from unnest(coalesce(p_selected_fields, array[]::text[])) as selected(selected_field)
  join public.model_update_request_fields requested_field
    on requested_field.request_id = p_request_id
   and requested_field.field_key = selected_field
   and requested_field.allow_auto_apply = true
   and requested_field.is_sensitive = false;

  select to_jsonb(m.*)
    into previous_model
  from public.models m
  where m.id = request_record.model_id
  for update;

  if previous_model is null then
    raise exception 'model_not_found';
  end if;

  contact_text := nullif(payload->>'contact', '');
  email_candidate := coalesce(nullif(payload->>'email', ''), substring(coalesce(contact_text, '') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'));
  phone_candidate := coalesce(nullif(payload->>'phone', ''), nullif(payload->>'whatsapp', ''), substring(coalesce(contact_text, '') from '\+?[0-9][0-9\s().-]{7,}'));

  location_text := nullif(payload->>'location', '');
  if location_text is not null then
    location_city := nullif(trim(split_part(location_text, ',', 1)), '');
    location_country := nullif(trim(substr(location_text, length(split_part(location_text, ',', 1)) + 2)), '');
  end if;

  update public.models
  set
    email = case
      when 'email' = any(selected_safe) and email_candidate is not null then lower(email_candidate)
      when 'contact' = any(selected_safe) and email_candidate is not null then lower(email_candidate)
      else email
    end,
    phone = case
      when 'phone' = any(selected_safe) and phone_candidate is not null then trim(phone_candidate)
      when 'contact' = any(selected_safe) and phone_candidate is not null then trim(phone_candidate)
      else phone
    end,
    whatsapp = case
      when 'whatsapp' = any(selected_safe) and phone_candidate is not null then trim(phone_candidate)
      when 'contact' = any(selected_safe) and phone_candidate is not null then trim(phone_candidate)
      else whatsapp
    end,
    location = case
      when 'location' = any(selected_safe) and location_text is not null then location_text
      else location
    end,
    current_city = case
      when 'current_city' = any(selected_safe) and nullif(payload->>'current_city', '') is not null then nullif(payload->>'current_city', '')
      when 'location' = any(selected_safe) and location_city is not null then location_city
      else current_city
    end,
    current_country = case
      when 'current_country' = any(selected_safe) and nullif(payload->>'current_country', '') is not null then nullif(payload->>'current_country', '')
      when 'location' = any(selected_safe) and location_country is not null then location_country
      else current_country
    end,
    base_city = case
      when 'base_city' = any(selected_safe) and nullif(payload->>'base_city', '') is not null then nullif(payload->>'base_city', '')
      when 'location' = any(selected_safe) and location_city is not null then location_city
      else base_city
    end,
    base_country = case
      when 'base_country' = any(selected_safe) and nullif(payload->>'base_country', '') is not null then nullif(payload->>'base_country', '')
      when 'location' = any(selected_safe) and location_country is not null then location_country
      else base_country
    end,
    height_cm = case
      when 'height_cm' = any(selected_safe) and (payload->>'height_cm') ~ '^[0-9]{2,3}$' then (payload->>'height_cm')::integer
      else height_cm
    end,
    bust_cm = case
      when 'bust_cm' = any(selected_safe) and (payload->>'bust_cm') ~ '^[0-9]{2,3}$' then (payload->>'bust_cm')::integer
      else bust_cm
    end,
    waist_cm = case
      when 'waist_cm' = any(selected_safe) and (payload->>'waist_cm') ~ '^[0-9]{2,3}$' then (payload->>'waist_cm')::integer
      else waist_cm
    end,
    hips_cm = case
      when 'hips_cm' = any(selected_safe) and (payload->>'hips_cm') ~ '^[0-9]{2,3}$' then (payload->>'hips_cm')::integer
      else hips_cm
    end,
    shoe_size = case
      when 'shoe_size' = any(selected_safe) and nullif(payload->>'shoe_size', '') is not null then nullif(payload->>'shoe_size', '')
      when 'shoe_size_br' = any(selected_safe) and nullif(payload->>'shoe_size_br', '') is not null then nullif(payload->>'shoe_size_br', '')
      else shoe_size
    end,
    shoe_size_br = case
      when 'shoe_size_br' = any(selected_safe) and nullif(payload->>'shoe_size_br', '') is not null then nullif(payload->>'shoe_size_br', '')
      when 'shoe_size' = any(selected_safe) and nullif(payload->>'shoe_size', '') is not null then nullif(payload->>'shoe_size', '')
      else shoe_size_br
    end,
    dress_size_br = case
      when 'dress_size_br' = any(selected_safe) and nullif(payload->>'dress_size_br', '') is not null then nullif(payload->>'dress_size_br', '')
      else dress_size_br
    end,
    last_profile_update_at = current_time,
    profile_reviewed_at = current_time,
    last_measurements_update_at = case
      when selected_safe && array['height_cm', 'bust_cm', 'waist_cm', 'hips_cm', 'shoe_size', 'shoe_size_br', 'dress_size_br'] then current_time
      else last_measurements_update_at
    end
  where id = request_record.model_id
  returning to_jsonb(models.*) into new_model;

  if 'instagram' = any(selected_safe) and nullif(payload->>'instagram', '') is not null then
    insert into public.model_social_links (model_id, instagram)
    values (request_record.model_id, nullif(payload->>'instagram', ''))
    on conflict (model_id)
    do update set instagram = excluded.instagram, updated_at = now();
  end if;

  select coalesce(array_agg(field_name), array[]::text[])
    into applied_field_names
  from (
    select unnest(selected_safe) as field_name
  ) applied
  where payload ? field_name
     or field_name in ('email', 'phone', 'whatsapp', 'current_city', 'current_country', 'base_city', 'base_country');

  for approved_file in
    select f.*
    from public.model_update_files f
    where f.submission_id = submission_record.id
      and f.id = any(coalesce(p_approved_file_ids, array[]::uuid[]))
      and f.status = 'pending_review'
    order by f.position, f.created_at
  loop
    insert into public.model_media (
      media_type,
      model_id,
      review_notes,
      status,
      storage_bucket,
      storage_path,
      title,
      visibility
    )
    values (
      approved_file.media_type::public.media_type,
      request_record.model_id,
      case
        when approved_file.sha256 is not null then 'Recebido via Model Portal. SHA-256: ' || approved_file.sha256
        else 'Recebido via Model Portal.'
      end,
      'approved',
      approved_file.bucket,
      approved_file.object_path,
      approved_file.original_name,
      case when approved_file.media_type = 'document' then 'private' else 'client_only' end::public.media_visibility
    );

    update public.model_update_files
    set status = 'approved'
    where id = approved_file.id;

    approved_file_ids := approved_file_ids || approved_file.id;
  end loop;

  update public.model_update_submissions
  set
    applied_at = current_time,
    applied_snapshot = jsonb_build_object(
      'selected_fields', coalesce(p_selected_fields, array[]::text[]),
      'applied_fields', applied_field_names,
      'approved_file_ids', approved_file_ids,
      'legacy_measurements_review_only', payload ? 'measurements'
    ),
    previous_snapshot = previous_model,
    reviewed_by = auth.uid(),
    status = 'applied'
  where id = submission_record.id;

  update public.model_update_requests
  set
    applied_at = current_time,
    status = 'applied',
    updated_by = auth.uid()
  where id = p_request_id;

  insert into public.model_update_audit_events (
    created_by,
    event_type,
    metadata,
    model_id,
    new_snapshot,
    previous_snapshot,
    request_id
  )
  values (
    auth.uid(),
    'applied',
    jsonb_build_object(
      'selected_fields', coalesce(p_selected_fields, array[]::text[]),
      'applied_fields', applied_field_names,
      'approved_file_ids', approved_file_ids,
      'sensitive_fields_reviewed_only', (
        select coalesce(jsonb_agg(field_key), '[]'::jsonb)
        from public.model_update_request_fields
        where request_id = p_request_id
          and is_sensitive = true
          and payload ? field_key
      )
    ),
    request_record.model_id,
    new_model,
    previous_model,
    p_request_id
  );

  return true;
end;
$$;

create or replace function public.current_model_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select m.id
  from public.models m
  where m.user_id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_model_update_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  model_uuid uuid;
begin
  model_uuid := public.current_model_id();

  if model_uuid is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'status', r.status,
        'due_at', r.due_at,
        'expires_at', r.expires_at,
        'submitted_at', r.submitted_at,
        'fields', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'field_key', f.field_key,
              'field_group', f.field_group,
              'is_required', f.is_required,
              'is_sensitive', f.is_sensitive
            )
            order by f.position
          )
          from public.model_update_request_fields f
          where f.request_id = r.id
        ), '[]'::jsonb)
      )
      order by r.created_at desc
    )
    from public.model_update_requests r
    where r.model_id = model_uuid
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_model_update_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  model_uuid uuid;
  payload jsonb;
begin
  model_uuid := public.current_model_id();

  if model_uuid is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'message', r.message,
    'status', r.status,
    'due_at', r.due_at,
    'expires_at', r.expires_at,
    'submitted_at', r.submitted_at,
    'fields', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'field_key', f.field_key,
          'field_group', f.field_group,
          'is_required', f.is_required,
          'is_sensitive', f.is_sensitive
        )
        order by f.position
      )
      from public.model_update_request_fields f
      where f.request_id = r.id
    ), '[]'::jsonb)
  )
  into payload
  from public.model_update_requests r
  where r.id = p_request_id
    and r.model_id = model_uuid;

  return payload;
end;
$$;

create or replace function public.get_my_model_update_submission(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  model_uuid uuid;
  payload jsonb;
begin
  model_uuid := public.current_model_id();

  if model_uuid is null then
    return null;
  end if;

  select jsonb_build_object(
    'status', s.status,
    'draft_payload', s.draft_payload,
    'submitted_payload', s.submitted_payload,
    'submitted_at', s.submitted_at,
    'files', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'media_type', f.media_type,
          'original_name', f.original_name,
          'mime_type', f.mime_type,
          'size_bytes', f.size_bytes,
          'status', f.status,
          'position', f.position
        )
        order by f.position, f.created_at
      )
      from public.model_update_files f
      where f.submission_id = s.id
    ), '[]'::jsonb)
  )
  into payload
  from public.model_update_submissions s
  join public.model_update_requests r on r.id = s.request_id
  where s.request_id = p_request_id
    and r.model_id = model_uuid;

  return payload;
end;
$$;

create or replace function public.claim_outbound_emails(p_limit integer default 5)
returns setof public.outbound_emails
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.outbound_emails
    where status in ('queued', 'scheduled', 'retry_pending')
      and (scheduled_at is null or scheduled_at <= now())
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  )
  update public.outbound_emails e
  set status = 'processing',
      attempt_count = e.attempt_count + 1,
      updated_at = now()
  from claimed
  where e.id = claimed.id
  returning e.*;
end;
$$;

revoke all on function public.get_public_presentation_by_token(text) from public;
revoke all on function public.mark_public_presentation_opened(text) from public;
revoke all on function public.get_public_model_update_request_by_token(text) from public;
revoke all on function public.mark_model_update_request_opened(text) from public;
revoke all on function public.start_model_update_request(text) from public;
revoke all on function public.save_model_update_request_draft(text, jsonb) from public;
revoke all on function public.submit_model_update_request(text, jsonb) from public;
revoke all on function public.verify_model_update_code(text, text) from public;
revoke all on function public.apply_model_update_submission(uuid, text[], uuid[]) from public;
revoke all on function public.current_model_id() from public;
revoke all on function public.get_my_model_update_requests() from public;
revoke all on function public.get_my_model_update_request(uuid) from public;
revoke all on function public.get_my_model_update_submission(uuid) from public;
revoke all on function public.check_communication_rate_limit(text, text, text, integer, integer) from public;
revoke all on function public.sanitize_model_update_payload(uuid, jsonb, boolean) from public;
revoke all on function public.update_presentation_draft(uuid, uuid, jsonb) from public;
revoke all on function public.publish_presentation_snapshot(uuid, uuid, jsonb) from public;
revoke all on function public.claim_outbound_emails(integer) from public;

grant execute on function public.get_public_presentation_by_token(text) to anon, authenticated;
grant execute on function public.mark_public_presentation_opened(text) to anon, authenticated;
grant execute on function public.get_public_model_update_request_by_token(text) to anon, authenticated;
grant execute on function public.mark_model_update_request_opened(text) to anon, authenticated;
grant execute on function public.start_model_update_request(text) to anon, authenticated;
grant execute on function public.save_model_update_request_draft(text, jsonb) to anon, authenticated;
grant execute on function public.submit_model_update_request(text, jsonb) to anon, authenticated;
grant execute on function public.verify_model_update_code(text, text) to anon, authenticated;
grant execute on function public.apply_model_update_submission(uuid, text[], uuid[]) to authenticated;
grant execute on function public.current_model_id() to authenticated;
grant execute on function public.get_my_model_update_requests() to authenticated;
grant execute on function public.get_my_model_update_request(uuid) to authenticated;
grant execute on function public.get_my_model_update_submission(uuid) to authenticated;
grant execute on function public.check_communication_rate_limit(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.update_presentation_draft(uuid, uuid, jsonb) to authenticated;
grant execute on function public.publish_presentation_snapshot(uuid, uuid, jsonb) to authenticated;
grant execute on function public.claim_outbound_emails(integer) to service_role;
