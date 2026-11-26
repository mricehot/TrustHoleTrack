-- Anotações de tratamento: como fazer, dúvidas tiradas e dicas (aba Tratamento).
create table if not exists public.tratativa_notas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  projeto text not null default '',
  titulo text not null check (char_length(titulo) between 1 and 120),
  texto text not null default '' check (char_length(texto) <= 4000),
  categoria text not null default 'como_fazer' check (categoria in ('como_fazer','duvida','dica')),
  fixada boolean not null default false,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists tratativa_notas_empresa_idx on public.tratativa_notas(empresa_id, criado_em desc);
create trigger trg_preencher_empresa before insert on public.tratativa_notas for each row execute function public.preencher_empresa_id();
alter table public.tratativa_notas enable row level security;
create policy "somente empresa tratativa_notas" on public.tratativa_notas for all to authenticated
  using (empresa_id = (select public.empresa_do_usuario_atual()))
  with check (empresa_id = (select public.empresa_do_usuario_atual()));
alter publication supabase_realtime add table public.tratativa_notas;
