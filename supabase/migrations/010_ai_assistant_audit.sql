create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_role public.user_role not null,
  user_message text not null,
  assistant_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null,
  error text,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ai_tool_calls_status_check check (status in ('success', 'error'))
);

alter table public.ai_conversations enable row level security;
alter table public.ai_tool_calls enable row level security;

drop policy if exists "users read own ai conversations" on public.ai_conversations;
create policy "users read own ai conversations"
on public.ai_conversations for select
using (actor_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "users insert own ai conversations" on public.ai_conversations;
create policy "users insert own ai conversations"
on public.ai_conversations for insert
with check (
  actor_id = auth.uid()
  and actor_role = public.current_user_role()
);

drop policy if exists "users read own ai tool calls" on public.ai_tool_calls;
create policy "users read own ai tool calls"
on public.ai_tool_calls for select
using (actor_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "users insert own ai tool calls" on public.ai_tool_calls;
create policy "users insert own ai tool calls"
on public.ai_tool_calls for insert
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_tool_calls.conversation_id
      and c.actor_id = auth.uid()
  )
);

create index if not exists ai_conversations_actor_id_created_at_idx
on public.ai_conversations(actor_id, created_at desc);

create index if not exists ai_tool_calls_conversation_id_idx
on public.ai_tool_calls(conversation_id);

create index if not exists ai_tool_calls_actor_id_created_at_idx
on public.ai_tool_calls(actor_id, created_at desc);

grant select, insert on public.ai_conversations to authenticated;
grant select, insert on public.ai_tool_calls to authenticated;
