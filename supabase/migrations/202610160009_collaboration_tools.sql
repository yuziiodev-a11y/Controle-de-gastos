-- Rateio de despesas, histórico, fechamento mensal e anexos privados.
alter table public.expenses
  add column if not exists paid_by text,
  add column if not exists shared_with text[] not null default '{}',
  add column if not exists notes text;

create table if not exists public.month_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,
  snapshot jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.month_closures enable row level security;
create policy "Users manage own month closures" on public.month_closures for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.month_closures to authenticated;

create table if not exists public.expense_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  description text not null,
  action text not null check (action in ('created', 'updated', 'settled', 'deleted')),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists expense_history_user_expense_idx on public.expense_history(user_id, expense_id, changed_at desc);
alter table public.expense_history enable row level security;
create policy "Users read own expense history" on public.expense_history for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.expense_history to authenticated;

create or replace function public.log_expense_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.expense_history(user_id, expense_id, description, action, new_data)
    values (new.user_id, new.id, new.description, 'created', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.expense_history(user_id, expense_id, description, action, old_data, new_data)
    values (new.user_id, new.id, new.description,
      case when old.status = 'pending' and new.status = 'settled' then 'settled' else 'updated' end,
      to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.expense_history(user_id, expense_id, description, action, old_data)
    values (old.user_id, old.id, old.description, 'deleted', to_jsonb(old));
    return old;
  end if;
end;
$$;
drop trigger if exists expenses_history_trigger on public.expenses;
create trigger expenses_history_trigger
after insert or update or delete on public.expenses
for each row execute function public.log_expense_history();

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);
alter table public.expense_attachments enable row level security;
create policy "Users manage own expense attachments" on public.expense_attachments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())
  ));
grant select, insert, update, delete on public.expense_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Users read own expense receipts" on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own expense receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own expense receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
