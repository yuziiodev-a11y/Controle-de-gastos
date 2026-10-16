create table public.savings_pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  goal_amount numeric(12,2) check (goal_amount is null or goal_amount > 0),
  opening_balance numeric(12,2) not null default 0 check (opening_balance >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.savings_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pot_id uuid not null,
  kind text not null check (kind in ('deposit', 'withdrawal')),
  amount numeric(12,2) not null check (amount > 0),
  moved_on date not null default current_date,
  note text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now(),
  constraint savings_movement_pot_owner_fk foreign key (pot_id, user_id)
    references public.savings_pots(id, user_id) on delete cascade
);

create index savings_pots_user_id_idx on public.savings_pots(user_id);
create index savings_movements_user_date_idx on public.savings_movements(user_id, moved_on desc);
create index savings_movements_pot_id_idx on public.savings_movements(pot_id);

alter table public.savings_pots enable row level security;
alter table public.savings_movements enable row level security;

create policy "Read own savings pots" on public.savings_pots for select to authenticated using (auth.uid() = user_id);
create policy "Insert own savings pots" on public.savings_pots for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own savings pots" on public.savings_pots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own savings pots" on public.savings_pots for delete to authenticated using (auth.uid() = user_id);

create policy "Read own savings movements" on public.savings_movements for select to authenticated using (auth.uid() = user_id);
create policy "Insert own savings movements" on public.savings_movements for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own savings movements" on public.savings_movements for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own savings movements" on public.savings_movements for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.savings_pots, public.savings_movements to authenticated;
