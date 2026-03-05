create table if not exists public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  arrives_at time not null,
  departs_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date),
  check (arrives_at < departs_at)
);

create index if not exists idx_availability_windows_date on public.availability_windows(date);
create index if not exists idx_availability_windows_user_id on public.availability_windows(user_id);

alter table public.availability_windows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'availability_windows'
      and policyname = 'availability windows public access'
  ) then
    create policy "availability windows public access" on public.availability_windows
      for all
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'availability_windows_set_updated_at'
  ) then
    create trigger availability_windows_set_updated_at
    before update on public.availability_windows
    for each row
    execute procedure public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'availability_windows'
    ) then
      alter publication supabase_realtime add table public.availability_windows;
    end if;
  end if;
end
$$;

alter table public.participants add column if not exists arrives_at time;
alter table public.participants add column if not exists departs_at time;
