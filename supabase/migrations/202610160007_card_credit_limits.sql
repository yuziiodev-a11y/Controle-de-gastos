-- Guarda, quando informados, os limites totais e disponíveis de cada cartão.
alter table public.cards
  add column if not exists credit_limit numeric(12,2),
  add column if not exists available_limit numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.cards'::regclass and conname = 'cards_credit_limit_nonnegative') then
    alter table public.cards add constraint cards_credit_limit_nonnegative check (credit_limit is null or credit_limit >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cards'::regclass and conname = 'cards_available_limit_nonnegative') then
    alter table public.cards add constraint cards_available_limit_nonnegative check (available_limit is null or available_limit >= 0);
  end if;
end $$;
