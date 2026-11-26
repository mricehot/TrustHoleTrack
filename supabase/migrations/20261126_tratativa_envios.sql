-- Envios da tratativa de perfilagem: data em que a tratativa foi feita e enviada e a metragem enviada (agrupado por mes no app).
create table if not exists public.tratativa_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  projeto text not null default '',
  anel_id uuid,
  anel_rotulo text not null default '',
  data date not null,
  metragem numeric not null default 0 check (metragem >= 0),
  leques text not null default '' check (char_length(leques) <= 200),
  observacao text not null default '' check (char_length(observacao) <= 400),
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists tratativa_envios_empresa_data_idx on public.tratativa_envios(empresa_id, data desc);
create trigger trg_preencher_empresa before insert on public.tratativa_envios for each row execute function public.preencher_empresa_id();
alter table public.tratativa_envios enable row level security;
create policy "somente empresa tratativa_envios" on public.tratativa_envios for all to authenticated
  using (empresa_id = (select public.empresa_do_usuario_atual()))
  with check (empresa_id = (select public.empresa_do_usuario_atual()));
alter publication supabase_realtime add table public.tratativa_envios;
