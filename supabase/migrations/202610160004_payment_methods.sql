-- Diferencia pagamentos em Pix/dinheiro/débito de compras no crédito.
alter table public.expenses add column if not exists payment_method text;

-- Lançamentos já associados a um cartão são compras no crédito; os demais ficam como "outro".
update public.expenses
set payment_method = case when card_id is not null then 'credit_card' else 'other' end
where payment_method is null;

alter table public.expenses alter column payment_method set default 'other';
alter table public.expenses alter column payment_method set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.expenses'::regclass and conname = 'expenses_payment_method_check') then
    alter table public.expenses add constraint expenses_payment_method_check
      check (payment_method in ('credit_card', 'debit_card', 'pix', 'cash', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.expenses'::regclass and conname = 'expenses_card_payment_method_check') then
    alter table public.expenses add constraint expenses_card_payment_method_check
      check (card_id is null or (kind = 'expense' and payment_method = 'credit_card'));
  end if;
end $$;
