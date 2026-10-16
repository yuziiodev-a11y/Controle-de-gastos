-- Tabelas e políticas de segurança: cada usuário só acessa seus próprios dados.
create extension if not exists pgcrypto;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid,
  description text not null check (char_length(description) between 1 and 100),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Outros',
  spent_on date not null default current_date,
  invoice_month date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now(),
  constraint expenses_card_owner_fk foreign key (card_id, user_id)
    references public.cards(id, user_id) on delete set null (card_id)
);

create index if not exists expenses_user_spent_on_idx on public.expenses(user_id, spent_on desc);
create index if not exists expenses_user_invoice_month_idx on public.expenses(user_id, invoice_month, card_id);

alter table public.cards enable row level security;
alter table public.expenses enable row level security;

create policy "Read own cards" on public.cards for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own cards" on public.cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own cards" on public.cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own cards" on public.cards for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own expenses" on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own expenses" on public.expenses for insert to authenticated with check (
  (select auth.uid()) = user_id and (card_id is null or exists (
    select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid())
  ))
);
create policy "Update own expenses" on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and (card_id is null or exists (
    select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid())
  ))
);
create policy "Delete own expenses" on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.cards, public.expenses to authenticated;
