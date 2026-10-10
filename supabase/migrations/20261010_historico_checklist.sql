-- Histórico de quem mexeu no checklist (auditoria). Idempotente. Só gestor lê.
create table if not exists public.checklist_historico (
  id bigint generated always as identity primary key,
  empresa_id uuid not null,
  tabela text not null,
  registro_id uuid not null,
  furo_numero text,
  campo text not null,
  valor_antigo text,
  valor_novo text,
  usuario_id uuid,
  usuario_email text,
  em timestamptz not null default now()
);
create index if not exists checklist_historico_registro_idx on public.checklist_historico (registro_id, em desc);
create index if not exists checklist_historico_empresa_idx on public.checklist_historico (empresa_id, em desc);
alter table public.checklist_historico enable row level security;
drop policy if exists "historico select gestor" on public.checklist_historico;
create policy "historico select gestor" on public.checklist_historico for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()));
-- sem policy de insert/update/delete: só o gatilho (security definer) escreve.

create or replace function public.registrar_historico_checklist() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; c text; o jsonb; n jsonb; campos text[];
begin
  select email into v_email from auth.users where id = auth.uid();
  if tg_table_name = 'checklist_furos' then campos := array['perfilado','topografado','obstruido','metragem','observacao'];
  else campos := array['perfilado','observacao']; end if;
  if tg_op = 'INSERT' then
    insert into public.checklist_historico(empresa_id,tabela,registro_id,furo_numero,campo,valor_novo,usuario_id,usuario_email)
    values (new.empresa_id, tg_table_name, new.id, case when tg_table_name='checklist_furos' then new.numero::text end, 'criado', 'sim', auth.uid(), v_email);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.checklist_historico(empresa_id,tabela,registro_id,furo_numero,campo,valor_antigo,valor_novo,usuario_id,usuario_email)
    values (old.empresa_id, tg_table_name, old.id, case when tg_table_name='checklist_furos' then old.numero::text end, 'removido', 'sim', 'sim', auth.uid(), v_email);
    return old;
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  foreach c in array campos loop
    if (o->>c) is distinct from (n->>c) then
      insert into public.checklist_historico(empresa_id,tabela,registro_id,furo_numero,campo,valor_antigo,valor_novo,usuario_id,usuario_email)
      values (new.empresa_id, tg_table_name, new.id, case when tg_table_name='checklist_furos' then new.numero::text end, c, o->>c, n->>c, auth.uid(), v_email);
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.registrar_historico_checklist() from public, anon, authenticated;

drop trigger if exists trg_historico_checklist_furos on public.checklist_furos;
create trigger trg_historico_checklist_furos after insert or update or delete on public.checklist_furos
  for each row execute function public.registrar_historico_checklist();
drop trigger if exists trg_historico_checklist_leques on public.checklist_leques;
create trigger trg_historico_checklist_leques after insert or update or delete on public.checklist_leques
  for each row execute function public.registrar_historico_checklist();
