alter table public.sessions add column ends_at timestamptz;
update public.sessions set ends_at = starts_at + interval '2 hours' where ends_at is null;
alter table public.sessions alter column ends_at set not null;

alter table public.sessions add column court text;

alter table public.sessions alter column capacity drop not null;
alter table public.sessions alter column capacity set default null;
