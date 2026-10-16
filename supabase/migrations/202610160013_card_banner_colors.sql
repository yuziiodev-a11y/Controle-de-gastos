-- Salva a cor escolhida para o banner de cada cartão.
alter table public.cards
  add column if not exists color text not null default 'violet';

alter table public.cards
  drop constraint if exists cards_color_allowed;

alter table public.cards
  add constraint cards_color_allowed
  check (color in (
    'violet', 'purple', 'indigo', 'blue', 'cyan', 'pink', 'rose', 'graphite',
    'navy', 'sky', 'teal', 'emerald', 'lime', 'red', 'coral', 'brown', 'black', 'silver'
  ));
