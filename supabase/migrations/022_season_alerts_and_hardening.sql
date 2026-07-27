create table if not exists public.international_season_alerts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.model_international_seasons(id) on delete cascade,
  alert_type text not null,
  due_on date not null,
  priority text not null default 'medium',
  title text not null,
  description text,
  link_path text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_season_alerts_type_check check (
    alert_type in (
      'contract_90_days',
      'contract_60_days',
      'contract_30_days',
      'contract_15_days',
      'contract_7_days',
      'contract_last_day',
      'payment_due',
      'payment_overdue',
      'visa_expiring',
      'pocket_money_late',
      'return_ticket_missing',
      'contract_document_missing',
      'visa_document_missing',
      'financial_closing_pending'
    )
  ),
  constraint international_season_alerts_priority_check check (priority in ('low', 'medium', 'high')),
  constraint international_season_alerts_status_check check (status in ('scheduled', 'active', 'resolved', 'dismissed'))
);

create unique index if not exists international_season_alerts_unique
on public.international_season_alerts (season_id, alert_type, due_on);

create index if not exists international_season_alerts_due_idx
on public.international_season_alerts (due_on, status, priority);

create or replace function public.generate_international_season_contract_alerts(target_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  season record;
  alert_offsets integer[] := array[90, 60, 30, 15, 7, 0];
  alert_offset integer;
  alert_type text;
  alert_title text;
begin
  select s.*, m.stage_name, m.display_name, a.display_name as agency_name
  into season
  from public.model_international_seasons s
  join public.models m on m.id = s.model_id
  join public.partner_agencies a on a.id = s.receiving_agency_id
  where s.id = target_season_id;

  if season.id is null then
    return;
  end if;

  foreach alert_offset in array alert_offsets loop
    alert_type := case alert_offset
      when 90 then 'contract_90_days'
      when 60 then 'contract_60_days'
      when 30 then 'contract_30_days'
      when 15 then 'contract_15_days'
      when 7 then 'contract_7_days'
      else 'contract_last_day'
    end;

    alert_title := case alert_offset
      when 60 then 'Contrato de ' || coalesce(season.stage_name, season.display_name) || ' na ' || season.agency_name || ' termina em dois meses.'
      when 0 then 'Contrato de ' || coalesce(season.stage_name, season.display_name) || ' termina hoje.'
      else 'Contrato de ' || coalesce(season.stage_name, season.display_name) || ' termina em ' || alert_offset::text || ' dias.'
    end;

    insert into public.international_season_alerts (
      season_id,
      alert_type,
      due_on,
      priority,
      title,
      description,
      link_path
    )
    values (
      season.id,
      alert_type,
      season.contract_end_date - alert_offset,
      case when alert_offset <= 15 then 'high' when alert_offset <= 60 then 'medium' else 'low' end,
      alert_title,
      season.city || ', ' || season.country,
      '/admin/travel/' || coalesce(season.trip_id, season.id)::text
    )
    on conflict (season_id, alert_type, due_on)
    do update set
      title = excluded.title,
      description = excluded.description,
      link_path = excluded.link_path,
      priority = excluded.priority,
      updated_at = now();
  end loop;

  if season.final_payment_due_date is not null then
    insert into public.international_season_alerts (
      season_id,
      alert_type,
      due_on,
      priority,
      title,
      description,
      link_path
    )
    values (
      season.id,
      'payment_due',
      season.final_payment_due_date,
      'medium',
      'Pagamento final de ' || coalesce(season.stage_name, season.display_name) || ' previsto.',
      'Prazo final da temporada internacional.',
      '/admin/travel/' || coalesce(season.trip_id, season.id)::text || '/finance'
    )
    on conflict (season_id, alert_type, due_on)
    do update set
      title = excluded.title,
      description = excluded.description,
      link_path = excluded.link_path,
      priority = excluded.priority,
      updated_at = now();
  end if;

  if season.return_ticket_status = 'pending_document' then
    insert into public.international_season_alerts (
      season_id,
      alert_type,
      due_on,
      priority,
      title,
      description,
      link_path
    )
    values (
      season.id,
      'return_ticket_missing',
      greatest(current_date, season.contract_end_date - 30),
      'medium',
      'Passagem de retorno pendente.',
      coalesce(season.stage_name, season.display_name) || ' ainda não possui documento de retorno cadastrado.',
      '/admin/travel/' || coalesce(season.trip_id, season.id)::text || '/documents'
    )
    on conflict (season_id, alert_type, due_on)
    do update set
      title = excluded.title,
      description = excluded.description,
      link_path = excluded.link_path,
      priority = excluded.priority,
      updated_at = now();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_international_season_alerts_updated_at'
      and tgrelid = 'public.international_season_alerts'::regclass
  ) then
    create trigger set_international_season_alerts_updated_at
    before update on public.international_season_alerts
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.international_season_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'international_season_alerts'
      and policyname = 'admins manage international season alerts'
  ) then
    create policy "admins manage international season alerts"
    on public.international_season_alerts for all
    using (public.current_user_role() = 'admin')
    with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admins manage travel document objects'
  ) then
    create policy "admins manage travel document objects"
    on storage.objects for all
    using (
      bucket_id = 'model-documents'
      and name like 'travel/%'
      and public.current_user_role() = 'admin'
    )
    with check (
      bucket_id = 'model-documents'
      and name like 'travel/%'
      and public.current_user_role() = 'admin'
    );
  end if;
end $$;
