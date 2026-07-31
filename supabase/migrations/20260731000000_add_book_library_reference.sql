alter table public.books
  add column if not exists library_reference jsonb;
