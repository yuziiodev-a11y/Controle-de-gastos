-- Amplia lançamentos para contas a pagar e a receber, preservando os gastos existentes.
alter table public.expenses
  add column if not exists kind text not null default 'expense',
  add column if not exists due_date date,
  add column if not exists status text not null default 'settled';

update public.expenses set due_date = spent_on where due_date is null;
alter table public.expenses alter column due_date set not null;
alter table public.expenses alter column due_date set default current_date;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.expenses'::regclass and conname = 'expenses_kind_check') then
    alter table public.expenses add constraint expenses_kind_check check (kind in ('expense', 'income'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.expenses'::regclass and conname = 'expenses_status_check') then
    alter table public.expenses add constraint expenses_status_check check (status in ('pending', 'settled'));
  end if;
end $$;

create index if not exists expenses_user_kind_due_date_idx on public.expenses (user_id, kind, status, due_date);
