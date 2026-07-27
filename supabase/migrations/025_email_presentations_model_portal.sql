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
