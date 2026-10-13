-- Pendencias: o que esta travando a producao (obstrucao, equipamento, area...), com status, responsavel e prazo.
create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  projeto text not null default '',
  anel_id uuid,
  anel_rotulo text not null default '',
  titulo text not null check (char_length(titulo) between 1 and 120),
  detalhe text not null default '' check (char_length(detalhe) <= 600),
  categoria text not null default 'outro' check (categoria in ('obstrucao','equipamento','area','outro')),
  status text not null default 'aberta' check (status in ('aberta','em_resolucao','resolvida')),
  responsavel text not null default '',
  prazo date,
  equipe_id uuid references public.equipes(id) on delete set null,
  criado_por text,
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por text
);
create index if not exists pendencias_empresa_status_idx on public.pendencias(empresa_id, status, criado_em desc);
create trigger trg_preencher_empresa before insert on public.pendencias for each row execute function public.preencher_empresa_id();
alter table public.pendencias enable row level security;
create policy "somente empresa pendencias" on public.pendencias for all to authenticated
  using (empresa_id = (select public.empresa_do_usuario_atual()))
  with check (empresa_id = (select public.empresa_do_usuario_atual()));
alter publication supabase_realtime add table public.pendencias;
