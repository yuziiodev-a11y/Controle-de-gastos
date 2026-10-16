-- Novos recursos: parcelamento, metas com prazo, categorias e lembretes.
alter table public.expenses
  add column installment_group_id uuid,
  add column installment_number smallint,
  add column installment_count smallint,
  add constraint expenses_installment_pair_check check (
    (installment_group_id is null and installment_number is null and installment_count is null)
    or (installment_group_id is not null and installment_number is not null and installment_count is not null and installment_number between 1 and installment_count and installment_count between 2 and 48)
  );
create index expenses_installment_group_idx on public.expenses(installment_group_id) where installment_group_id is not null;
alter table public.savings_pots add column goal_due_date date;

create table public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);
alter table public.user_categories enable row level security;
create policy "Users manage own categories" on public.user_categories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.user_categories to authenticated;

create table public.reminder_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  days_before smallint not null default 1 check (days_before in (1, 2, 3, 7)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
create policy "Users manage own reminder settings" on public.reminder_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.reminder_settings to authenticated;

-- Tabela privada, usada somente pela Edge Function para deduplicar envios.
create table public.reminder_dispatches (
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, expense_id, reminder_date)
);
alter table public.reminder_dispatches enable row level security;
