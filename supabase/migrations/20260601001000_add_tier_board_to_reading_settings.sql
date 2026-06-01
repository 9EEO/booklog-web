alter table public.reading_settings
  add column if not exists tier_board jsonb not null default '{"S":[],"A":[],"B":[],"C":[],"D":[]}';
