create table if not exists public.model_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null check (
    option_type in ('skill', 'sport', 'hobby', 'language', 'instrument')
  ),
  label text not null,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_options_type_label_unique unique (option_type, label)
);

alter table public.model_options enable row level security;

drop trigger if exists set_model_options_updated_at on public.model_options;
create trigger set_model_options_updated_at
before update on public.model_options
for each row execute function public.set_updated_at();

drop policy if exists "admins manage model options" on public.model_options;
create policy "admins manage model options"
on public.model_options for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

alter table public.model_skills
  add column if not exists skill_options text[] not null default '{}',
  add column if not exists sport_options text[] not null default '{}',
  add column if not exists hobby_options text[] not null default '{}',
  add column if not exists language_levels jsonb not null default '{}'::jsonb;

alter table public.model_health_logistics
  add column if not exists has_drivers_license boolean not null default false,
  add column if not exists drivers_license_category text,
  add column if not exists drivers_license_number text,
  add column if not exists drivers_license_country text,
  add column if not exists drivers_license_notes text;

insert into public.model_options (option_type, label, sort_order) values
  ('sport', 'CrossFit', 10),
  ('sport', 'Musculacao / academia', 20),
  ('sport', 'Yoga', 30),
  ('sport', 'Pilates', 40),
  ('sport', 'Ballet', 50),
  ('sport', 'Danca contemporanea', 60),
  ('sport', 'Danca urbana', 70),
  ('sport', 'Hip hop', 80),
  ('sport', 'Jazz dance', 90),
  ('sport', 'Pole dance', 100),
  ('sport', 'Natacao', 110),
  ('sport', 'Surf', 120),
  ('sport', 'Skate', 130),
  ('sport', 'Patins', 140),
  ('sport', 'Ciclismo', 150),
  ('sport', 'Corrida', 160),
  ('sport', 'Futebol', 170),
  ('sport', 'Volei', 180),
  ('sport', 'Basquete', 190),
  ('sport', 'Tenis', 200),
  ('sport', 'Beach tennis', 210),
  ('sport', 'Pingue-pongue', 220),
  ('sport', 'Boxe', 230),
  ('sport', 'Muay Thai', 240),
  ('sport', 'Karate', 250),
  ('sport', 'Kung Fu', 260),
  ('sport', 'Jiu-jitsu', 270),
  ('sport', 'Judo', 280),
  ('sport', 'Taekwondo', 290),
  ('sport', 'MMA', 300),
  ('sport', 'Escalada', 310),
  ('sport', 'Equitacao', 320),
  ('sport', 'Ginastica', 330),
  ('sport', 'Atletismo', 340),
  ('skill', 'Atuacao', 10),
  ('skill', 'Teatro', 20),
  ('skill', 'Improvisacao', 30),
  ('skill', 'Apresentacao', 40),
  ('skill', 'Danca', 50),
  ('skill', 'Canto', 60),
  ('skill', 'Dublagem', 70),
  ('skill', 'Voice over', 80),
  ('skill', 'Performance de camera', 90),
  ('skill', 'Passarela', 100),
  ('skill', 'Runway coaching', 110),
  ('skill', 'Posing', 120),
  ('skill', 'Public speaking', 130),
  ('hobby', 'Cozinhar', 10),
  ('hobby', 'Barista', 20),
  ('hobby', 'Bartender', 30),
  ('hobby', 'Dirigir carro', 40),
  ('hobby', 'Dirigir moto', 50),
  ('hobby', 'Andar de bicicleta', 60),
  ('hobby', 'Nadar', 70),
  ('hobby', 'Mergulho', 80),
  ('hobby', 'Esqui', 90),
  ('hobby', 'Snowboard', 100),
  ('hobby', 'Camping', 110),
  ('hobby', 'Hiking / trilha', 120),
  ('hobby', 'Pet friendly / trabalha com animais', 130),
  ('hobby', 'Criancas / bom com criancas', 140),
  ('instrument', 'Piano', 10),
  ('instrument', 'Violao', 20),
  ('instrument', 'Guitarra', 30),
  ('instrument', 'Baixo', 40),
  ('instrument', 'Bateria', 50),
  ('instrument', 'Violino', 60),
  ('instrument', 'Violoncelo', 70),
  ('instrument', 'Saxofone', 80),
  ('instrument', 'Flauta', 90),
  ('instrument', 'Trompete', 100),
  ('instrument', 'DJ', 110),
  ('instrument', 'Producao musical', 120),
  ('language', 'Portugues', 10),
  ('language', 'Ingles', 20),
  ('language', 'Espanhol', 30),
  ('language', 'Frances', 40),
  ('language', 'Italiano', 50),
  ('language', 'Alemao', 60),
  ('language', 'Russo', 70),
  ('language', 'Ucraniano', 80),
  ('language', 'Chines / Mandarim', 90),
  ('language', 'Japones', 100),
  ('language', 'Coreano', 110),
  ('language', 'Tailandes', 120),
  ('language', 'Arabe', 130)
on conflict (option_type, label) do nothing;
