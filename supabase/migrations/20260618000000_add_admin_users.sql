create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'Admins can select themselves'
  ) then
    create policy "Admins can select themselves"
    on public.admin_users
    for select
    using (auth.uid() = user_id);
  end if;
end $$;

insert into public.admin_users (user_id)
select id
from auth.users
where email = 'uhyoong@gmail.com'
on conflict (user_id) do nothing;
