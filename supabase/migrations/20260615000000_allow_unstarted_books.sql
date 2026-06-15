alter table public.books
  alter column started_at drop not null;

alter table public.reading_rounds
  alter column started_at drop not null;
