create table if not exists public.reading_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  status text not null check (status in ('reading', 'completed')),
  current_page integer not null default 1 check (current_page > 0),
  started_at date not null,
  completed_at date,
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, round_number)
);

alter table public.reading_rounds enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_rounds'
      and policyname = 'Users can select their reading rounds'
  ) then
    create policy "Users can select their reading rounds"
    on public.reading_rounds
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_rounds'
      and policyname = 'Users can insert their reading rounds'
  ) then
    create policy "Users can insert their reading rounds"
    on public.reading_rounds
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_rounds'
      and policyname = 'Users can update their reading rounds'
  ) then
    create policy "Users can update their reading rounds"
    on public.reading_rounds
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reading_rounds'
      and policyname = 'Users can delete their reading rounds'
  ) then
    create policy "Users can delete their reading rounds"
    on public.reading_rounds
    for delete
    using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists reading_rounds_user_id_idx
  on public.reading_rounds (user_id);

create index if not exists reading_rounds_book_id_round_number_idx
  on public.reading_rounds (book_id, round_number);

alter table public.reading_records
  add column if not exists round_id uuid references public.reading_rounds(id) on delete set null;

create index if not exists reading_records_round_id_idx
  on public.reading_records (round_id);

insert into public.reading_rounds (
  user_id,
  book_id,
  round_number,
  status,
  current_page,
  started_at,
  completed_at,
  accumulated_seconds
)
select
  books.user_id,
  books.id,
  1,
  books.status,
  greatest(books.current_page, 1),
  books.started_at,
  books.completed_at,
  greatest(books.accumulated_seconds, 0)
from public.books
where not exists (
  select 1
  from public.reading_rounds
  where reading_rounds.book_id = books.id
    and reading_rounds.round_number = 1
);

update public.reading_records
set round_id = reading_rounds.id
from public.reading_rounds
where reading_records.round_id is null
  and reading_records.book_id = reading_rounds.book_id
  and reading_rounds.round_number = 1;
