do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'job_created',
      'job_approved_for_model',
      'job_waiting_model',
      'job_confirmed',
      'job_canceled',
      'job_reminder',
      'model_profile_update_request',
      'model_measurements_update_request',
      'model_media_update_request',
      'client_request_update'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'email_delivery_status') then
    create type public.email_delivery_status as enum (
      'pending',
      'sent',
      'failed',
      'canceled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'email_provider') then
    create type public.email_provider as enum (
      'gmail',
      'resend',
      'manual',
      'disabled'
    );
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_role public.user_role not null,
  type public.notification_type not null,
  title text not null,
  message text not null,
  action_url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template_key text references public.email_templates(key) on delete set null,
  recipient_email text not null,
  recipient_name text,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  sender_email text,
  sender_name text,
  reply_to text,
  subject text not null,
  body_html text not null,
  body_text text not null,
  status public.email_delivery_status not null default 'pending',
  provider public.email_provider not null default 'disabled',
  provider_message_id text,
  entity_type text,
  entity_id uuid,
  error_message text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_settings (
  id uuid primary key default gen_random_uuid(),
  provider public.email_provider not null default 'disabled',
  sender_email text not null,
  sender_name text not null,
  reply_to text,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_profile_id, created_at desc);

create index if not exists notifications_unread_idx
on public.notifications (recipient_profile_id, read_at)
where read_at is null;

create index if not exists notifications_entity_idx
on public.notifications (entity_type, entity_id);

create index if not exists email_outbox_status_created_idx
on public.email_outbox (status, created_at desc);

create index if not exists email_outbox_recipient_profile_idx
on public.email_outbox (recipient_profile_id, created_at desc);

create index if not exists email_outbox_entity_idx
on public.email_outbox (entity_type, entity_id);

alter table public.notifications enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_outbox enable row level security;
alter table public.email_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_email_templates_updated_at') then
    create trigger set_email_templates_updated_at
    before update on public.email_templates
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_email_outbox_updated_at') then
    create trigger set_email_outbox_updated_at
    before update on public.email_outbox
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_email_settings_updated_at') then
    create trigger set_email_settings_updated_at
    before update on public.email_settings
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'admins manage notifications'
  ) then
    create policy "admins manage notifications"
    on public.notifications for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'users read own notifications'
  ) then
    create policy "users read own notifications"
    on public.notifications for select
    using (recipient_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'users mark own notifications read'
  ) then
    create policy "users mark own notifications read"
    on public.notifications for update
    using (recipient_profile_id = auth.uid())
    with check (recipient_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_templates'
      and policyname = 'admins manage email templates'
  ) then
    create policy "admins manage email templates"
    on public.email_templates for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_outbox'
      and policyname = 'admins manage email outbox'
  ) then
    create policy "admins manage email outbox"
    on public.email_outbox for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_outbox'
      and policyname = 'users read own email outbox'
  ) then
    create policy "users read own email outbox"
    on public.email_outbox for select
    using (recipient_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_settings'
      and policyname = 'admins manage email settings'
  ) then
    create policy "admins manage email settings"
    on public.email_settings for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;
end $$;

insert into public.email_templates (
  key,
  name,
  subject,
  body_html,
  body_text,
  variables
)
values
  (
    'model_job_invitation',
    'Convite de trabalho para modelo',
    'Novo trabalho disponível: {{job_title}}',
    '<p>Olá {{model_name}},</p><p>Você recebeu um novo convite para <strong>{{job_title}}</strong>.</p><p><a href="{{action_url}}">Ver detalhes do trabalho</a></p>',
    'Olá {{model_name}}, você recebeu um novo convite para {{job_title}}. Ver detalhes: {{action_url}}',
    array['model_name', 'job_title', 'action_url']
  ),
  (
    'model_job_reminder',
    'Lembrete de trabalho para modelo',
    'Lembrete: {{job_title}}',
    '<p>Olá {{model_name}},</p><p>Este é um lembrete sobre <strong>{{job_title}}</strong>.</p><p><a href="{{action_url}}">Abrir agenda</a></p>',
    'Olá {{model_name}}, este é um lembrete sobre {{job_title}}. Abrir agenda: {{action_url}}',
    array['model_name', 'job_title', 'action_url']
  ),
  (
    'model_casting_invitation',
    'Convite de casting para modelo',
    'Casting disponível: {{casting_title}}',
    '<p>Olá {{model_name}},</p><p>Você recebeu um convite de casting: <strong>{{casting_title}}</strong>.</p><p><a href="{{action_url}}">Ver casting</a></p>',
    'Olá {{model_name}}, você recebeu um convite de casting: {{casting_title}}. Ver casting: {{action_url}}',
    array['model_name', 'casting_title', 'action_url']
  ),
  (
    'model_option_notice',
    'Aviso de opção para modelo',
    'Opção em andamento: {{option_title}}',
    '<p>Olá {{model_name}},</p><p>Há uma opção em andamento para <strong>{{option_title}}</strong>.</p><p><a href="{{action_url}}">Ver opção</a></p>',
    'Olá {{model_name}}, há uma opção em andamento para {{option_title}}. Ver opção: {{action_url}}',
    array['model_name', 'option_title', 'action_url']
  ),
  (
    'model_profile_update_request',
    'Solicitação de atualização de perfil',
    'Atualize seu perfil AROLAB',
    '<p>Olá {{model_name}},</p><p>Precisamos que você revise seus dados de perfil.</p><p><a href="{{action_url}}">Atualizar perfil</a></p>',
    'Olá {{model_name}}, precisamos que você revise seus dados de perfil. Atualizar: {{action_url}}',
    array['model_name', 'action_url']
  ),
  (
    'model_measurements_update_request',
    'Solicitação de atualização de medidas',
    'Atualize suas medidas AROLAB',
    '<p>Olá {{model_name}},</p><p>Precisamos que você atualize suas medidas.</p><p><a href="{{action_url}}">Atualizar medidas</a></p>',
    'Olá {{model_name}}, precisamos que você atualize suas medidas. Atualizar: {{action_url}}',
    array['model_name', 'action_url']
  ),
  (
    'model_media_update_request',
    'Solicitação de novas polaroids',
    'Envie novas polaroids para a AROLAB',
    '<p>Olá {{model_name}},</p><p>Precisamos que você envie novas polaroids ou materiais recentes.</p><p><a href="{{action_url}}">Enviar material</a></p>',
    'Olá {{model_name}}, precisamos que você envie novas polaroids ou materiais recentes. Enviar: {{action_url}}',
    array['model_name', 'action_url']
  ),
  (
    'client_job_request_received',
    'Confirmação de pedido do cliente',
    'Recebemos seu pedido: {{request_title}}',
    '<p>Olá {{client_name}},</p><p>Recebemos seu pedido <strong>{{request_title}}</strong>. Nossa equipe vai revisar e retornar em breve.</p>',
    'Olá {{client_name}}, recebemos seu pedido {{request_title}}. Nossa equipe vai revisar e retornar em breve.',
    array['client_name', 'request_title']
  ),
  (
    'admin_new_client_request',
    'Novo pedido de cliente para admin',
    'Novo pedido de cliente: {{request_title}}',
    '<p>Um novo pedido de cliente chegou: <strong>{{request_title}}</strong>.</p><p><a href="{{action_url}}">Abrir pedido</a></p>',
    'Um novo pedido de cliente chegou: {{request_title}}. Abrir pedido: {{action_url}}',
    array['request_title', 'action_url']
  )
on conflict (key) do update
set
  name = excluded.name,
  subject = excluded.subject,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  variables = excluded.variables,
  is_active = true;

insert into public.email_settings (
  id,
  provider,
  sender_email,
  sender_name,
  reply_to,
  is_enabled
)
values (
  '00000000-0000-0000-0000-000000000010',
  'disabled',
  'claudio@arolab.co',
  'AROLAB',
  'claudio@arolab.co',
  false
)
on conflict (id) do update
set
  provider = excluded.provider,
  sender_email = excluded.sender_email,
  sender_name = excluded.sender_name,
  reply_to = excluded.reply_to,
  is_enabled = excluded.is_enabled;
