create table if not exists public.book_library_references (
  isbn13 text primary key,
  library_reference jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_library_references enable row level security;
