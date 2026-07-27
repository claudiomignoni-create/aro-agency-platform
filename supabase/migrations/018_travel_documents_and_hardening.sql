do $$
begin
  if not exists (select 1 from pg_type where typname = 'travel_document_type') then
    create type public.travel_document_type as enum (
      'ticket',
      'e_ticket',
      'booking_confirmation',
      'visa',
      'insurance',
      'hotel',
      'related_document'
    );
  end if;
end $$;

create table if not exists public.travel_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.model_trips(id) on delete cascade,
  document_type public.travel_document_type not null default 'related_document',
  title text not null,
  storage_bucket text not null default 'model-documents',
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_documents_private_bucket_check check (storage_bucket = 'model-documents'),
  constraint travel_documents_storage_prefix_check check (storage_path like 'travel/%')
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_travel_documents_updated_at'
      and tgrelid = 'public.travel_documents'::regclass
  ) then
    create trigger set_travel_documents_updated_at
    before update on public.travel_documents
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists travel_documents_trip_id_idx on public.travel_documents (trip_id);
create index if not exists travel_documents_type_idx on public.travel_documents (document_type);

alter table public.travel_documents enable row level security;

drop policy if exists "admins manage travel documents" on public.travel_documents;
create policy "admins manage travel documents"
on public.travel_documents for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create or replace function public.prevent_travel_document_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'travel_documents_require_storage_cleanup_workflow';
end;
$$;

drop trigger if exists prevent_travel_document_delete on public.travel_documents;
create trigger prevent_travel_document_delete
before delete on public.travel_documents
for each row execute function public.prevent_travel_document_hard_delete();
