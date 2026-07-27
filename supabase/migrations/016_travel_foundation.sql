do $$
begin
  if not exists (select 1 from pg_type where typname = 'trip_reason') then
    create type public.trip_reason as enum (
      'international_season',
      'job',
      'casting',
      'test_shoot',
      'return',
      'meeting',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'trip_status') then
    create type public.trip_status as enum (
      'planned',
      'booked',
      'in_transit',
      'arrived',
      'hosted',
      'completed',
      'canceled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'flight_segment_status') then
    create type public.flight_segment_status as enum (
      'planned',
      'booked',
      'check_in_open',
      'boarding',
      'departed',
      'in_flight',
      'landed',
      'delayed',
      'canceled'
    );
  end if;
end $$;

create table if not exists public.model_trips (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  title text not null,
  reason public.trip_reason not null default 'other',
  status public.trip_status not null default 'planned',
  starts_on date,
  ends_on date,
  origin_city text,
  origin_country text,
  destination_city text,
  destination_country text,
  destination_latitude numeric(9, 6),
  destination_longitude numeric(9, 6),
  agency_name text,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_trips_end_after_start check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint model_trips_destination_latitude_check check (destination_latitude is null or destination_latitude between -90 and 90),
  constraint model_trips_destination_longitude_check check (destination_longitude is null or destination_longitude between -180 and 180)
);

create table if not exists public.travel_flight_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.model_trips(id) on delete cascade,
  airline_name text,
  airline_code text,
  flight_number text,
  pnr text,
  ticket_number text,
  departure_airport text,
  departure_iata text,
  departure_city text,
  departure_country text,
  departure_at timestamptz,
  departure_timezone text,
  departure_terminal text,
  departure_gate text,
  arrival_airport text,
  arrival_iata text,
  arrival_city text,
  arrival_country text,
  arrival_at timestamptz,
  arrival_timezone text,
  arrival_terminal text,
  seat text,
  baggage text,
  cabin_class text,
  status public.flight_segment_status not null default 'planned',
  check_in_url text,
  cost_amount numeric(12, 2),
  currency text default 'BRL',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_flight_segments_arrival_after_departure check (
    arrival_at is null or departure_at is null or arrival_at >= departure_at
  ),
  constraint travel_flight_segments_currency_check check (
    currency is null or currency in ('BRL', 'USD', 'EUR')
  )
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_model_trips_updated_at'
      and tgrelid = 'public.model_trips'::regclass
  ) then
    create trigger set_model_trips_updated_at
    before update on public.model_trips
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_travel_flight_segments_updated_at'
      and tgrelid = 'public.travel_flight_segments'::regclass
  ) then
    create trigger set_travel_flight_segments_updated_at
    before update on public.travel_flight_segments
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists model_trips_model_id_idx on public.model_trips (model_id);
create index if not exists model_trips_status_idx on public.model_trips (status);
create index if not exists model_trips_reason_idx on public.model_trips (reason);
create index if not exists model_trips_dates_idx on public.model_trips (starts_on, ends_on);
create index if not exists model_trips_destination_idx on public.model_trips (destination_country, destination_city);
create index if not exists travel_flight_segments_trip_id_idx on public.travel_flight_segments (trip_id);
create index if not exists travel_flight_segments_departure_at_idx on public.travel_flight_segments (departure_at);
create index if not exists travel_flight_segments_status_idx on public.travel_flight_segments (status);
create index if not exists travel_flight_segments_iata_idx on public.travel_flight_segments (departure_iata, arrival_iata);

alter table public.model_trips enable row level security;
alter table public.travel_flight_segments enable row level security;

drop policy if exists "admins manage model trips" on public.model_trips;
create policy "admins manage model trips"
on public.model_trips for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins manage travel flight segments" on public.travel_flight_segments;
create policy "admins manage travel flight segments"
on public.travel_flight_segments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
