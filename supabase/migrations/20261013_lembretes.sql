-- Lembretes pessoais (painel lateral / botao flutuante): cada usuario ve so os seus.
create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  feito boolean not null default false,
  feito_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists lembretes_user_idx on public.lembretes(user_id, criado_em);
alter table public.lembretes enable row level security;
create policy lembretes_select on public.lembretes for select to authenticated using (user_id = (select auth.uid()));
create policy lembretes_insert on public.lembretes for insert to authenticated with check (user_id = (select auth.uid()));
create policy lembretes_update on public.lembretes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lembretes_delete on public.lembretes for delete to authenticated using (user_id = (select auth.uid()));
