-- Guarda separadamente o dia em que uma conta foi efetivamente paga/recebida.
alter table public.expenses add column if not exists settled_on date;

-- Mantém os lançamentos antigos coerentes com o histórico já registrado.
update public.expenses
set settled_on = spent_on
where status = 'settled' and settled_on is null;
