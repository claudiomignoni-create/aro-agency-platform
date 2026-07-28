create table if not exists public.presentation_selection_responses (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  presentation_version_id uuid references public.presentation_versions(id) on delete set null,
  presentation_share_link_id uuid references public.presentation_share_links(id) on delete cascade,
  presentation_recipient_id uuid references public.presentation_recipients(id) on delete set null,
  scope_type text not null,
  scope_id uuid not null,
  client_note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presentation_selection_responses_scope_check
    check (scope_type in ('share_link', 'legacy_link')),
  constraint presentation_selection_responses_note_check
    check (client_note is null or char_length(client_note) <= 2000),
  constraint presentation_selection_responses_scope_reference_check
    check (
      (scope_type = 'share_link' and presentation_share_link_id = scope_id)
      or
      (scope_type = 'legacy_link' and presentation_share_link_id is null and presentation_id = scope_id)
    ),
  unique (scope_type, scope_id)
);

create table if not exists public.presentation_model_selections (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.presentation_selection_responses(id) on delete cascade,
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  presentation_recipient_id uuid references public.presentation_recipients(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  public_model_key text not null,
  decision text not null,
  selected_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presentation_model_selections_decision_check
    check (decision in ('yes', 'maybe', 'no')),
  constraint presentation_model_selections_key_check
    check (
      char_length(public_model_key) between 8 and 128
      and public_model_key ~ '^[A-Za-z0-9_-]+$'
    ),
  unique (response_id, public_model_key)
);

create index if not exists presentation_selection_responses_presentation_idx
on public.presentation_selection_responses (presentation_id, updated_at desc);

create index if not exists presentation_model_selections_presentation_idx
on public.presentation_model_selections (presentation_id, decision, updated_at desc);

alter table public.presentation_selection_responses enable row level security;
alter table public.presentation_model_selections enable row level security;

drop policy if exists "admins manage presentation selection responses"
on public.presentation_selection_responses;
create policy "admins manage presentation selection responses"
on public.presentation_selection_responses
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage presentation model selections"
on public.presentation_model_selections;
create policy "admins manage presentation model selections"
on public.presentation_model_selections
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop trigger if exists set_presentation_selection_responses_updated_at
on public.presentation_selection_responses;
create trigger set_presentation_selection_responses_updated_at
before update on public.presentation_selection_responses
for each row execute function public.set_updated_at();

drop trigger if exists set_presentation_model_selections_updated_at
on public.presentation_model_selections;
create trigger set_presentation_model_selections_updated_at
before update on public.presentation_model_selections
for each row execute function public.set_updated_at();

create or replace function public.resolve_public_presentation_token(p_token_hash text)
returns table (
  presentation_id uuid,
  presentation_version_id uuid,
  presentation_share_link_id uuid,
  presentation_recipient_id uuid,
  recipient_name text,
  link_expires_at timestamptz,
  allow_downloads boolean,
  snapshot jsonb,
  scope_type text,
  scope_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token_hash is null
    or length(p_token_hash) <> 64
    or p_token_hash !~ '^[a-f0-9]{64}$'
  then
    return;
  end if;

  return query
  select
    p.id,
    pv.id,
    sl.id,
    sl.recipient_id,
    r.recipient_name,
    case
      when sl.expires_at is null then p.expires_at
      when p.expires_at is null then sl.expires_at
      else least(sl.expires_at, p.expires_at)
    end,
    p.allow_downloads,
    coalesce(nullif(pv.snapshot, '{}'::jsonb), nullif(p.snapshot, '{}'::jsonb), '{}'::jsonb),
    'share_link'::text,
    sl.id
  from public.presentation_share_links sl
  join public.presentations p on p.id = sl.presentation_id
  left join public.presentation_versions pv
    on pv.id = sl.presentation_version_id
   and pv.presentation_id = p.id
  left join public.presentation_recipients r
    on r.id = sl.recipient_id
   and r.presentation_id = p.id
  where sl.public_token_hash = p_token_hash
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.status in ('published', 'sent')
    and p.revoked_at is null
    and p.archived_at is null
    and (p.expires_at is null or p.expires_at > now())
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    p.id,
    pv.id,
    null::uuid,
    null::uuid,
    null::text,
    p.expires_at,
    p.allow_downloads,
    coalesce(nullif(p.snapshot, '{}'::jsonb), nullif(pv.snapshot, '{}'::jsonb), '{}'::jsonb),
    'legacy_link'::text,
    p.id
  from public.presentations p
  left join lateral (
    select version.id, version.snapshot
    from public.presentation_versions version
    where version.presentation_id = p.id
    order by version.version_number desc
    limit 1
  ) pv on true
  where p.public_token_hash = p_token_hash
    and p.status in ('published', 'sent')
    and p.revoked_at is null
    and p.archived_at is null
    and (p.expires_at is null or p.expires_at > now())
  limit 1;
end;
$$;

create or replace function public.get_public_presentation_by_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  context_record record;
  presentation_record record;
  payload jsonb;
  snapshot_source jsonb;
begin
  select * into context_record
  from public.resolve_public_presentation_token(p_token_hash)
  limit 1;

  if not found then
    return null;
  end if;

  select
    p.title,
    p.description,
    p.language,
    p.allow_downloads,
    p.published_at
  into presentation_record
  from public.presentations p
  where p.id = context_record.presentation_id;

  snapshot_source := coalesce(context_record.snapshot, '{}'::jsonb);

  select jsonb_build_object(
    'title', presentation_record.title,
    'description', presentation_record.description,
    'language', presentation_record.language,
    'allow_downloads', presentation_record.allow_downloads,
    'published_at', presentation_record.published_at,
    'link', jsonb_build_object(
      'expires_at', context_record.link_expires_at,
      'recipient_name', context_record.recipient_name,
      'state', 'active'
    ),
    'snapshot', jsonb_build_object(
      'title', snapshot_source->'title',
      'description', snapshot_source->'description',
      'contact', snapshot_source->'contact',
      'models', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'public_model_key', model_item.value->'public_model_key',
            'board', model_item.value->'board',
            'categories', model_item.value->'categories',
            'city', model_item.value->'city',
            'country', model_item.value->'country',
            'display_name', model_item.value->'display_name',
            'eye_color', model_item.value->'eye_color',
            'gender', model_item.value->'gender',
            'hair_color', model_item.value->'hair_color',
            'highlighted', model_item.value->'highlighted',
            'instagram', model_item.value->'instagram',
            'nationality', model_item.value->'nationality',
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
              from jsonb_array_elements(coalesce(model_item.value->'media', '[]'::jsonb))
                with ordinality media_item(value, ordinality)
            ), '[]'::jsonb)
          )
          order by model_item.ordinality
        )
        from jsonb_array_elements(coalesce(snapshot_source->'models', '[]'::jsonb))
          with ordinality model_item(value, ordinality)
      ), '[]'::jsonb)
    )
  )
  into payload;

  return payload;
end;
$$;

create or replace function public.get_public_presentation_link_state(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  presentation_record record;
  response_record record;
  resolved_scope_id uuid;
  resolved_scope_type text;
  resolved_state text;
begin
  if p_token_hash is null
    or length(p_token_hash) <> 64
    or p_token_hash !~ '^[a-f0-9]{64}$'
  then
    return jsonb_build_object('state', 'invalid');
  end if;

  select
    p.id as presentation_id,
    p.status as presentation_status,
    p.revoked_at as presentation_revoked_at,
    p.archived_at as presentation_archived_at,
    p.expires_at as presentation_expires_at,
    sl.id as share_link_id,
    sl.revoked_at as share_link_revoked_at,
    sl.expires_at as share_link_expires_at,
    sl.recipient_id,
    r.recipient_name
  into presentation_record
  from public.presentation_share_links sl
  join public.presentations p on p.id = sl.presentation_id
  left join public.presentation_recipients r
    on r.id = sl.recipient_id
   and r.presentation_id = p.id
  where sl.public_token_hash = p_token_hash
  limit 1;

  if found then
    resolved_scope_type := 'share_link';
    resolved_scope_id := presentation_record.share_link_id;
  else
    select
      p.id as presentation_id,
      p.status as presentation_status,
      p.revoked_at as presentation_revoked_at,
      p.archived_at as presentation_archived_at,
      p.expires_at as presentation_expires_at,
      null::uuid as share_link_id,
      null::timestamptz as share_link_revoked_at,
      null::timestamptz as share_link_expires_at,
      null::uuid as recipient_id,
      null::text as recipient_name
    into presentation_record
    from public.presentations p
    where p.public_token_hash = p_token_hash
    limit 1;

    if not found then
      return jsonb_build_object('state', 'invalid');
    end if;

    resolved_scope_type := 'legacy_link';
    resolved_scope_id := presentation_record.presentation_id;
  end if;

  resolved_state := case
    when presentation_record.share_link_revoked_at is not null
      or presentation_record.presentation_revoked_at is not null
      or presentation_record.presentation_archived_at is not null
      or presentation_record.presentation_status in ('revoked', 'archived')
      then 'revoked'
    when presentation_record.share_link_expires_at <= now()
      or presentation_record.presentation_expires_at <= now()
      or presentation_record.presentation_status = 'expired'
      then 'expired'
    when presentation_record.presentation_status not in ('published', 'sent')
      then 'not_published'
    else 'active'
  end;

  select
    response.client_note,
    response.submitted_at,
    coalesce((
      select jsonb_object_agg(selection.public_model_key, selection.decision)
      from public.presentation_model_selections selection
      where selection.response_id = response.id
    ), '{}'::jsonb) as decisions
  into response_record
  from public.presentation_selection_responses response
  where response.scope_type = resolved_scope_type
    and response.scope_id = resolved_scope_id
  limit 1;

  return jsonb_build_object(
    'state', resolved_state,
    'expires_at', case
      when presentation_record.share_link_expires_at is null then presentation_record.presentation_expires_at
      when presentation_record.presentation_expires_at is null then presentation_record.share_link_expires_at
      else least(presentation_record.share_link_expires_at, presentation_record.presentation_expires_at)
    end,
    'recipient_name', presentation_record.recipient_name,
    'selection', jsonb_build_object(
      'client_note', response_record.client_note,
      'decisions', coalesce(response_record.decisions, '{}'::jsonb),
      'submitted_at', response_record.submitted_at
    )
  );
end;
$$;

create or replace function public.save_public_presentation_model_decision(
  p_token_hash text,
  p_public_model_key text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  context_record record;
  model_record record;
  response_uuid uuid;
begin
  if p_public_model_key is null
    or char_length(p_public_model_key) not between 8 and 128
    or p_public_model_key !~ '^[A-Za-z0-9_-]+$'
    or p_decision not in ('yes', 'maybe', 'no')
  then
    raise exception 'invalid_selection_input';
  end if;

  select * into context_record
  from public.resolve_public_presentation_token(p_token_hash)
  limit 1;

  if not found then
    raise exception 'presentation_link_inactive';
  end if;

  select
    case
      when model_item.value->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (model_item.value->>'id')::uuid
      else null
    end as model_id
  into model_record
  from jsonb_array_elements(coalesce(context_record.snapshot->'models', '[]'::jsonb)) model_item(value)
  where model_item.value->>'public_model_key' = p_public_model_key
  limit 1;

  if not found then
    raise exception 'model_not_in_presentation_snapshot';
  end if;

  insert into public.presentation_selection_responses (
    presentation_id,
    presentation_version_id,
    presentation_share_link_id,
    presentation_recipient_id,
    scope_type,
    scope_id
  )
  values (
    context_record.presentation_id,
    context_record.presentation_version_id,
    context_record.presentation_share_link_id,
    context_record.presentation_recipient_id,
    context_record.scope_type,
    context_record.scope_id
  )
  on conflict (scope_type, scope_id)
  do update set
    presentation_version_id = excluded.presentation_version_id,
    presentation_recipient_id = excluded.presentation_recipient_id,
    submitted_at = null,
    updated_at = now()
  returning id into response_uuid;

  update public.presentation_model_selections
  set submitted_at = null
  where response_id = response_uuid;

  insert into public.presentation_model_selections (
    response_id,
    presentation_id,
    presentation_recipient_id,
    model_id,
    public_model_key,
    decision,
    selected_at
  )
  values (
    response_uuid,
    context_record.presentation_id,
    context_record.presentation_recipient_id,
    model_record.model_id,
    p_public_model_key,
    p_decision,
    now()
  )
  on conflict (response_id, public_model_key)
  do update set
    decision = excluded.decision,
    model_id = excluded.model_id,
    selected_at = now(),
    submitted_at = null,
    updated_at = now();

  insert into public.presentation_access_events (presentation_id, event_type, metadata)
  values (
    context_record.presentation_id,
    'selection_changed',
    jsonb_build_object(
      'decision', p_decision,
      'public_model_key', p_public_model_key,
      'recipient_id', context_record.presentation_recipient_id,
      'share_link_id', context_record.presentation_share_link_id
    )
  );

  return jsonb_build_object(
    'decision', p_decision,
    'public_model_key', p_public_model_key,
    'submitted_at', null
  );
end;
$$;

create or replace function public.submit_public_presentation_selection(
  p_token_hash text,
  p_client_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  context_record record;
  decision_count integer;
  response_record record;
  response_uuid uuid;
  submitted_timestamp timestamptz;
begin
  if p_client_note is not null and char_length(p_client_note) > 2000 then
    raise exception 'selection_note_too_long';
  end if;

  select * into context_record
  from public.resolve_public_presentation_token(p_token_hash)
  limit 1;

  if not found then
    raise exception 'presentation_link_inactive';
  end if;

  insert into public.presentation_selection_responses (
    presentation_id,
    presentation_version_id,
    presentation_share_link_id,
    presentation_recipient_id,
    scope_type,
    scope_id,
    client_note
  )
  values (
    context_record.presentation_id,
    context_record.presentation_version_id,
    context_record.presentation_share_link_id,
    context_record.presentation_recipient_id,
    context_record.scope_type,
    context_record.scope_id,
    nullif(btrim(p_client_note), '')
  )
  on conflict (scope_type, scope_id)
  do update set
    presentation_version_id = excluded.presentation_version_id,
    presentation_recipient_id = excluded.presentation_recipient_id,
    updated_at = now()
  returning id into response_uuid;

  select count(*) into decision_count
  from public.presentation_model_selections selection
  where selection.response_id = response_uuid;

  if decision_count = 0 then
    raise exception 'selection_has_no_decisions';
  end if;

  select id, client_note, submitted_at into response_record
  from public.presentation_selection_responses
  where id = response_uuid
  for update;

  if response_record.submitted_at is not null
    and coalesce(response_record.client_note, '') = coalesce(nullif(btrim(p_client_note), ''), '')
  then
    return jsonb_build_object(
      'decision_count', decision_count,
      'submitted_at', response_record.submitted_at
    );
  end if;

  submitted_timestamp := now();

  update public.presentation_selection_responses
  set
    client_note = nullif(btrim(p_client_note), ''),
    submitted_at = submitted_timestamp,
    updated_at = submitted_timestamp
  where id = response_uuid;

  update public.presentation_model_selections
  set
    submitted_at = submitted_timestamp,
    updated_at = submitted_timestamp
  where response_id = response_uuid;

  insert into public.presentation_access_events (presentation_id, event_type, metadata)
  values (
    context_record.presentation_id,
    'selection_submitted',
    jsonb_build_object(
      'decision_count', decision_count,
      'recipient_id', context_record.presentation_recipient_id,
      'share_link_id', context_record.presentation_share_link_id
    )
  );

  return jsonb_build_object(
    'decision_count', decision_count,
    'submitted_at', submitted_timestamp
  );
end;
$$;

create or replace function public.record_public_presentation_event(
  p_token_hash text,
  p_event_type text,
  p_public_model_key text default null,
  p_section text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  context_record record;
  model_exists boolean;
begin
  if p_event_type not in (
    'presentation_viewed',
    'model_viewed',
    'section_viewed',
    'file_downloaded'
  ) then
    raise exception 'unsupported_presentation_event';
  end if;

  if p_section is not null
    and (
      char_length(p_section) > 40
      or p_section not in ('overview', 'book', 'digitals', 'video', 'downloads')
    )
  then
    raise exception 'invalid_presentation_section';
  end if;

  select * into context_record
  from public.resolve_public_presentation_token(p_token_hash)
  limit 1;

  if not found then
    return false;
  end if;

  if p_public_model_key is not null then
    select exists (
      select 1
      from jsonb_array_elements(coalesce(context_record.snapshot->'models', '[]'::jsonb)) model_item(value)
      where model_item.value->>'public_model_key' = p_public_model_key
    ) into model_exists;

    if not model_exists then
      raise exception 'model_not_in_presentation_snapshot';
    end if;
  end if;

  insert into public.presentation_access_events (presentation_id, event_type, metadata)
  values (
    context_record.presentation_id,
    p_event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'public_model_key', p_public_model_key,
      'recipient_id', context_record.presentation_recipient_id,
      'section', p_section,
      'share_link_id', context_record.presentation_share_link_id
    ))
  );

  return true;
end;
$$;

create or replace function public.check_communication_rate_limit(
  p_token_hash text,
  p_ip_hash text,
  p_operation text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
  operation_limit integer;
  window_seconds integer;
begin
  if p_token_hash is null
    or p_ip_hash is null
    or p_operation is null
    or length(p_token_hash) <> 64
    or length(p_ip_hash) <> 64
    or length(p_operation) > 64
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_ip_hash !~ '^[a-f0-9]{64}$'
  then
    return false;
  end if;

  select limits.operation_limit, limits.window_seconds
    into operation_limit, window_seconds
  from (
    values
      ('presentation_open', 60, 60),
      ('presentation_event', 120, 60),
      ('presentation_download', 30, 60),
      ('presentation_selection_change', 40, 60),
      ('presentation_selection_submit', 5, 300),
      ('update_open', 40, 60),
      ('update_start', 20, 60),
      ('update_autosave', 20, 60),
      ('update_submit', 5, 300),
      ('otp_request', 3, 900),
      ('otp_verify', 6, 300),
      ('update_upload', 30, 60)
  ) as limits(operation, operation_limit, window_seconds)
  where limits.operation = p_operation;

  if operation_limit is null or window_seconds is null then
    raise exception 'unsupported_rate_limit_operation';
  end if;

  current_window := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

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

  if random() < 0.01 then
    delete from public.communication_rate_limits
    where window_start < now() - interval '24 hours';
  end if;

  return current_count <= operation_limit;
end;
$$;

revoke all on table public.presentation_selection_responses from anon, authenticated;
revoke all on table public.presentation_model_selections from anon, authenticated;

revoke all on function public.resolve_public_presentation_token(text)
from public, anon, authenticated, service_role;
revoke all on function public.get_public_presentation_by_token(text)
from public, anon, authenticated, service_role;
revoke all on function public.get_public_presentation_link_state(text)
from public, anon, authenticated, service_role;
revoke all on function public.save_public_presentation_model_decision(text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.submit_public_presentation_selection(text, text)
from public, anon, authenticated, service_role;
revoke all on function public.record_public_presentation_event(text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.check_communication_rate_limit(text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.resolve_public_presentation_token(text) to service_role;
grant execute on function public.get_public_presentation_by_token(text) to service_role;
grant execute on function public.get_public_presentation_link_state(text) to service_role;
grant execute on function public.save_public_presentation_model_decision(text, text, text) to service_role;
grant execute on function public.submit_public_presentation_selection(text, text) to service_role;
grant execute on function public.record_public_presentation_event(text, text, text, text) to service_role;
grant execute on function public.check_communication_rate_limit(text, text, text) to service_role;
