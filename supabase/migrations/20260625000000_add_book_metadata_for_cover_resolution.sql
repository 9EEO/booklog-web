alter table public.books
  add column if not exists isbn text,
  add column if not exists publisher text,
  add column if not exists contents text;
