alter table public.savings_pots
  add column if not exists cdi_percentage numeric(7,2)
  check (cdi_percentage is null or cdi_percentage between 0 and 1000);

comment on column public.savings_pots.cdi_percentage is
  'Percentage of the daily CDI used only for the savings pot gross-return estimate.';
