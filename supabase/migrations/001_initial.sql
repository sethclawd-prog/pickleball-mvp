create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  starts_at timestamptz not null,
  note text,
  capacity int default 8 check (capacity is null or capacity > 1),
  venue text not null default 'Bay Padel',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('confirmed', 'maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, user_id)
);

create table if not exists public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index if not exists idx_sessions_starts_at on public.sessions(starts_at);
create index if not exists idx_sessions_code on public.sessions(code);
create index if not exists idx_participants_session_id on public.participants(session_id);
create index if not exists idx_participants_user_id on public.participants(user_id);
create index if not exists idx_availability_templates_user_id on public.availability_templates(user_id);

create trigger users_set_updated_at
before update on public.users
for each row
execute procedure public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row
execute procedure public.set_updated_at();

create trigger participants_set_updated_at
before update on public.participants
for each row
execute procedure public.set_updated_at();

create trigger availability_set_updated_at
before update on public.availability_templates
for each row
execute procedure public.set_updated_at();

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.availability_templates enable row level security;

create policy "users public access" on public.users
for all
using (true)
with check (true);

create policy "sessions public access" on public.sessions
for all
using (true)
with check (true);

create policy "participants public access" on public.participants
for all
using (true)
with check (true);

create policy "availability public access" on public.availability_templates
for all
using (true)
with check (true);
