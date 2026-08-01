create table if not exists public.word_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  word text not null check (length(btrim(word)) > 0),
  definition text not null check (length(btrim(definition)) > 0),
  page integer check (page is null or page > 0),
  context_sentence text,
  recorded_at date not null default current_date,
  source text not null default 'woorimalsam' check (source in ('woorimalsam')),
  source_name text not null default '우리말샘',
  source_url text,
  license text not null default '',
  pos text,
  category text,
  origin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.word_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'word_notes'
      and policyname = 'Users can select their word notes'
  ) then
    create policy "Users can select their word notes"
    on public.word_notes
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'word_notes'
      and policyname = 'Users can insert their word notes'
  ) then
    create policy "Users can insert their word notes"
    on public.word_notes
    for insert
    with check (
      auth.uid() = user_id
      and exists (
        select 1
        from public.books
        where books.id = book_id
          and books.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'word_notes'
      and policyname = 'Users can update their word notes'
  ) then
    create policy "Users can update their word notes"
    on public.word_notes
    for update
    using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id
      and exists (
        select 1
        from public.books
        where books.id = book_id
          and books.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'word_notes'
      and policyname = 'Users can delete their word notes'
  ) then
    create policy "Users can delete their word notes"
    on public.word_notes
    for delete
    using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists word_notes_user_id_idx
  on public.word_notes (user_id);

create index if not exists word_notes_book_id_recorded_at_idx
  on public.word_notes (book_id, recorded_at desc, created_at desc);

create index if not exists word_notes_word_idx
  on public.word_notes (word);
