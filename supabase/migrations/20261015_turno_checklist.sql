-- Checklist de inicio de turno (itens da equipe + marcacoes por dia) e recado para o proximo turno.
create table if not exists public.turno_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 120),
  criado_por text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create table if not exists public.turno_checklist_marcas (
  id uuid primary key,
  empresa_id uuid references public.empresas(id),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  item_id uuid not null references public.turno_checklist_itens(id) on delete cascade,
  data date not null,
  feito boolean not null default true,
  feito_por text,
  feito_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (item_id, data)
);
create table if not exists public.turno_recados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  equipe_id uuid references public.equipes(id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 600),
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists turno_itens_eq_idx on public.turno_checklist_itens(equipe_id, ordem);
create index if not exists turno_marcas_eq_idx on public.turno_checklist_marcas(equipe_id, data);
create index if not exists turno_recados_em_idx on public.turno_recados(empresa_id, criado_em desc);
do $$ declare t text; begin
  foreach t in array array['turno_checklist_itens','turno_checklist_marcas','turno_recados'] loop
    execute format('create trigger trg_preencher_empresa before insert on public.%I for each row execute function public.preencher_empresa_id()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "somente empresa %1$s" on public.%1$I for all to authenticated using (empresa_id = (select public.empresa_do_usuario_atual())) with check (empresa_id = (select public.empresa_do_usuario_atual()))', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
