alter table public.model_media
  add column if not exists valid_until date,
  add column if not exists notes text;
