    -- Limites de gastos por categoria e mês, privados por usuário.
    create table public.category_budgets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      month date not null,
      category text not null check (char_length(category) between 1 and 40),
      amount numeric(12,2) not null check (amount > 0),
      created_at timestamptz not null default now(),
      unique (user_id, month, category)
    );

    alter table public.category_budgets enable row level security;
    create policy "Read own category budgets" on public.category_budgets for select to authenticated using (auth.uid() = user_id);
    create policy "Insert own category budgets" on public.category_budgets for insert to authenticated with check (auth.uid() = user_id);
    create policy "Update own category budgets" on public.category_budgets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    create policy "Delete own category budgets" on public.category_budgets for delete to authenticated using (auth.uid() = user_id);
    grant select, insert, update, delete on public.category_budgets to authenticated;

    -- Regras mensais para contas e receitas recorrentes.
    create table public.recurring_rules (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      kind text not null check (kind in ('expense', 'income')),
      description text not null check (char_length(description) between 1 and 100),
      amount numeric(12,2) not null check (amount > 0),
      category text not null default 'Outros',
      day_of_month smallint not null check (day_of_month between 1 and 31),
      payment_method text not null default 'other' check (payment_method in ('credit_card', 'debit_card', 'pix', 'cash', 'other')),
      card_id uuid,
      starts_on date not null,
      ends_on date,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (id, user_id),
      constraint recurring_card_owner_fk foreign key (card_id, user_id) references public.cards(id, user_id) on delete set null (card_id),
      constraint recurring_card_method_check check (card_id is null or (kind = 'expense' and payment_method = 'credit_card')),
      constraint recurring_dates_check check (ends_on is null or ends_on >= starts_on)
    );

    alter table public.expenses
      add column recurring_rule_id uuid,
      add column recurrence_month date;
    alter table public.expenses add constraint expenses_recurring_rule_owner_fk
      foreign key (recurring_rule_id, user_id) references public.recurring_rules(id, user_id) on delete set null (recurring_rule_id);
    create unique index expenses_recurring_occurrence_uidx
      on public.expenses (recurring_rule_id, recurrence_month) where recurring_rule_id is not null;

    alter table public.recurring_rules enable row level security;
    create policy "Read own recurring rules" on public.recurring_rules for select to authenticated using (auth.uid() = user_id);
    create policy "Insert own recurring rules" on public.recurring_rules for insert to authenticated with check (auth.uid() = user_id);
    create policy "Update own recurring rules" on public.recurring_rules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    create policy "Delete own recurring rules" on public.recurring_rules for delete to authenticated using (auth.uid() = user_id);
    grant select, insert, update, delete on public.recurring_rules to authenticated;

    create or replace function public.generate_recurring_expenses(p_month date)
    returns void
    language plpgsql
    security invoker
    set search_path = public
    as $$
    declare
      month_first date := date_trunc('month', p_month)::date;
      month_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
    begin
      insert into public.expenses (
        user_id, kind, description, amount, category, spent_on, due_date,
        status, payment_method, card_id, invoice_month, recurring_rule_id, recurrence_month
      )
      select r.user_id, r.kind, r.description, r.amount, r.category,
        make_date(extract(year from month_first)::int, extract(month from month_first)::int,
          least(r.day_of_month, extract(day from month_last)::int)),
        make_date(extract(year from month_first)::int, extract(month from month_first)::int,
          least(r.day_of_month, extract(day from month_last)::int)),
        'pending', r.payment_method, r.card_id, month_first, r.id, month_first
      from public.recurring_rules r
      where r.user_id = auth.uid()
        and r.active
        and r.starts_on <= month_last
        and (r.ends_on is null or r.ends_on >= month_first)
      on conflict (recurring_rule_id, recurrence_month) where recurring_rule_id is not null do nothing;
    end;
    $$;
    grant execute on function public.generate_recurring_expenses(date) to authenticated;
    revoke all on function public.generate_recurring_expenses(date) from public;
    grant execute on function public.generate_recurring_expenses(date) to authenticated;
