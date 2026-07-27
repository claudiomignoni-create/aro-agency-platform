alter table public.profiles
  add column if not exists title text,
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists preferred_language text;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system',
  locale text not null default 'pt-BR',
  density text not null default 'comfortable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme_check check (theme in ('system', 'light', 'dark')),
  constraint user_preferences_density_check check (density in ('compact', 'comfortable'))
);

create table if not exists public.operational_alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_key text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, alert_key)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_user_preferences_updated_at'
      and tgrelid = 'public.user_preferences'::regclass
  ) then
    create trigger set_user_preferences_updated_at
    before update on public.user_preferences
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists operational_alert_dismissals_user_idx
on public.operational_alert_dismissals (user_id, dismissed_at desc);

alter table public.user_preferences enable row level security;
alter table public.operational_alert_dismissals enable row level security;

drop policy if exists "users manage own preferences" on public.user_preferences;
create policy "users manage own preferences"
on public.user_preferences for all
using (user_id = auth.uid() or public.current_user_role() = 'admin')
with check (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "users manage own alert dismissals" on public.operational_alert_dismissals;
create policy "users manage own alert dismissals"
on public.operational_alert_dismissals for all
using (user_id = auth.uid() or public.current_user_role() = 'admin')
with check (user_id = auth.uid() or public.current_user_role() = 'admin');
