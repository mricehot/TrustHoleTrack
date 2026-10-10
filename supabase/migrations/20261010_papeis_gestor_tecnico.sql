-- Papéis gestor/técnico + travas no servidor (itens 1 a 4 das limitações para técnicos).
-- Pode ser rodado mais de uma vez (idempotente).
-- Regras: só gestor cria/exclui realces, leques e furos do checklist; técnico marca (update).
-- Enquanto não for aplicado, o app trata todos como gestor (nada fica travado).

alter table public.profiles add column if not exists papel text not null default 'tecnico' check (papel in ('gestor','tecnico'));
update public.profiles set papel='gestor' where lower(email) in ('atos.neves100@gmail.com','atosneves.dev@gmail.com','talles.firmiano@trustdrilling.com');

create or replace function public.eh_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'gestor' from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.eh_gestor() from public, anon;
grant execute on function public.eh_gestor() to authenticated;

drop function if exists public.listar_usuarios_empresa();
create or replace function public.listar_usuarios_empresa()
returns table(id uuid, email text, nome text, equipe_id uuid, papel text)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.email, coalesce(u.raw_user_meta_data->>'nome','') as nome, p.equipe_id, p.papel
  from public.profiles p join auth.users u on u.id = p.id
  where p.empresa_id = public.empresa_do_usuario_atual()
  order by p.email;
$$;
revoke all on function public.listar_usuarios_empresa() from public, anon;
grant execute on function public.listar_usuarios_empresa() to authenticated;

create or replace function public.definir_papel_usuario(p_usuario uuid, p_papel text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid := public.empresa_do_usuario_atual();
begin
  if not public.eh_gestor() then raise exception 'somente gestor'; end if;
  if p_papel not in ('gestor','tecnico') then raise exception 'papel invalido'; end if;
  if not exists (select 1 from public.profiles where id = p_usuario and empresa_id = v_emp) then raise exception 'usuario fora da empresa'; end if;
  if p_papel = 'tecnico' and p_usuario = auth.uid() and (select count(*) from public.profiles where empresa_id = v_emp and papel = 'gestor') <= 1 then
    raise exception 'a empresa precisa de pelo menos um gestor';
  end if;
  update public.profiles set papel = p_papel where id = p_usuario;
end $$;
revoke all on function public.definir_papel_usuario(uuid, text) from public, anon;
grant execute on function public.definir_papel_usuario(uuid, text) to authenticated;

-- Vincular usuário a equipe passa a ser só do gestor
create or replace function public.definir_equipe_usuario(p_usuario uuid, p_equipe uuid)
returns integer
language plpgsql security definer set search_path = public, auth as $$
declare v_emp uuid := public.empresa_do_usuario_atual(); v_email text; v_nome text; v_n int := 0; v_n2 int := 0;
begin
  if v_emp is null then raise exception 'sem empresa'; end if;
  if not public.eh_gestor() then raise exception 'somente gestor'; end if;
  select p.email, coalesce(u.raw_user_meta_data->>'nome','') into v_email, v_nome
    from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_usuario and p.empresa_id = v_emp;
  if v_email is null then raise exception 'usuario fora da empresa'; end if;
  if p_equipe is not null and not exists (select 1 from public.equipes where id = p_equipe and empresa_id = v_emp) then
    raise exception 'equipe fora da empresa';
  end if;
  update public.profiles set equipe_id = p_equipe where id = p_usuario;
  if p_equipe is not null then
    update public.checklist_furos set equipe_perfilagem_id = p_equipe
      where empresa_id = v_emp and equipe_perfilagem_id is null and perfilado
        and lower(perfilado_por) in (lower(split_part(v_email,'@',1)), lower(v_nome));
    get diagnostics v_n = row_count;
    update public.checklist_furos set equipe_topografia_id = p_equipe
      where empresa_id = v_emp and equipe_topografia_id is null and topografado
        and lower(topografado_por) in (lower(split_part(v_email,'@',1)), lower(v_nome));
    get diagnostics v_n2 = row_count;
  end if;
  return v_n + v_n2;
end $$;

-- Criar e excluir realces, leques e furos do checklist: só gestor. Técnicos marcam (update) no checklist.
do $$
declare t text;
begin
  foreach t in array array['aneis','leques','checklist_leques','checklist_furos'] loop
    execute format('drop policy if exists %I on public.%I', 'somente autenticados ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'leques por autenticado', t);
    execute format('drop policy if exists %I on public.%I', t || ' select', t);
    execute format('drop policy if exists %I on public.%I', t || ' insert', t);
    execute format('drop policy if exists %I on public.%I', t || ' update', t);
    execute format('drop policy if exists %I on public.%I', t || ' delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (empresa_id = (select public.empresa_do_usuario_atual()))', t || ' select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()))', t || ' insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (empresa_id = (select public.empresa_do_usuario_atual())) with check (empresa_id = (select public.empresa_do_usuario_atual()))', t || ' update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()))', t || ' delete', t);
  end loop;
end $$;

-- Equipes: leitura para todos, escrita só do gestor
drop policy if exists "somente autenticados equipes" on public.equipes;
drop policy if exists "equipes select" on public.equipes;
drop policy if exists "equipes insert gestor" on public.equipes;
drop policy if exists "equipes update gestor" on public.equipes;
drop policy if exists "equipes delete gestor" on public.equipes;
create policy "equipes select" on public.equipes for select to authenticated using (empresa_id = (select public.empresa_do_usuario_atual()));
create policy "equipes insert gestor" on public.equipes for insert to authenticated with check (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()));
create policy "equipes update gestor" on public.equipes for update to authenticated using (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor())) with check (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()));
create policy "equipes delete gestor" on public.equipes for delete to authenticated using (empresa_id = (select public.empresa_do_usuario_atual()) and (select public.eh_gestor()));
