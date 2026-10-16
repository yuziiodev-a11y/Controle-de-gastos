-- Rateio com partes personalizadas e controle de acertos por participante.
alter table public.expenses
  add column if not exists share_details jsonb not null default '[]'::jsonb;

-- Preserva os rateios antigos, convertendo a divisão igualitária em valores por pessoa.
with legacy_shares as (
  select e.id,
    jsonb_agg(jsonb_build_object(
      'name', participant.name,
      'amount', ((floor((e.amount * 100)::numeric / participant.total)::int
        + case when participant.ordinality <= mod(round(e.amount * 100)::int, participant.total) then 1 else 0 end)::numeric / 100),
      'settled', lower(participant.name) = lower(coalesce(e.paid_by, '')),
      'settled_on', case when lower(participant.name) = lower(coalesce(e.paid_by, '')) then e.spent_on else null end
    ) order by participant.ordinality) as details
  from public.expenses e
  cross join lateral (
    select clean.name, clean.ordinality, count(*) over () as total
    from (
      select trim(name) as name, min(ordinality) as ordinality
      from unnest(e.shared_with) with ordinality as names(name, ordinality)
      where trim(name) <> ''
      group by trim(name)
    ) clean
  ) participant
  where cardinality(e.shared_with) > 0 and e.share_details = '[]'::jsonb
  group by e.id
)
update public.expenses e set share_details = legacy_shares.details
from legacy_shares where e.id = legacy_shares.id;

comment on column public.expenses.share_details is
  'Rateio por participante: nome, valor, estado do acerto e data do acerto.';
