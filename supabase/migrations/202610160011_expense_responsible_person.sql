alter table public.expenses
  add column if not exists responsible_person text;

comment on column public.expenses.responsible_person is
  'Person responsible for an expense; installment records in the same group share this value.';
