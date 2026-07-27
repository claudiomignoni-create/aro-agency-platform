create or replace function public.generate_international_season_contract_alerts(target_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  season record;
  alert_offsets integer[] := array[90, 30, 15, 7, 0];
  alert_offset integer;
  v_alert_type text;
  v_alert_title text;
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
    'contract_60_days',
    coalesce(season.contract_reminder_date, season.contract_end_date - 60),
    'medium',
    'Contrato de ' || coalesce(season.stage_name, season.display_name) || ' na ' || season.agency_name || ' termina em dois meses.',
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

  foreach alert_offset in array alert_offsets loop
    v_alert_type := case alert_offset
      when 90 then 'contract_90_days'
      when 30 then 'contract_30_days'
      when 15 then 'contract_15_days'
      when 7 then 'contract_7_days'
      else 'contract_last_day'
    end;

    v_alert_title := case alert_offset
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
      v_alert_type,
      season.contract_end_date - alert_offset,
      case when alert_offset <= 15 then 'high' else 'low' end,
      v_alert_title,
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
