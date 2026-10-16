alter table public.expenses
  add column if not exists responsible_details jsonb not null default '[]'::jsonb;

alter table public.expenses
  drop constraint if exists expenses_responsible_details_is_array;

alter table public.expenses
  add constraint expenses_responsible_details_is_array
  check (jsonb_typeof(responsible_details) = 'array');

comment on column public.expenses.responsible_details is
  'Percentage allocation of responsibility across people; percentages should total 100 for expenses.';
