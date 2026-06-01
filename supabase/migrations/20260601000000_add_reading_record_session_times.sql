alter table public.reading_records
  add column if not exists session_started_at timestamptz,
  add column if not exists session_ended_at timestamptz;

create index if not exists reading_records_session_started_at_idx
  on public.reading_records (session_started_at desc);
