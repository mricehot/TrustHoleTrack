-- PDF do plano de perfuracao anexado ao realce. Bucket privado; so a mesma empresa le/grava.
alter table public.aneis add column if not exists plano_path text;
alter table public.aneis add column if not exists plano_nome text;
alter table public.aneis add column if not exists plano_atualizado_em timestamptz;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planos-perfuracao', 'planos-perfuracao', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
create policy "planos - ler da empresa" on storage.objects for select to authenticated
  using (bucket_id = 'planos-perfuracao' and (storage.foldername(name))[1] = (select public.empresa_do_usuario_atual())::text);
create policy "planos - enviar da empresa" on storage.objects for insert to authenticated
  with check (bucket_id = 'planos-perfuracao' and (storage.foldername(name))[1] = (select public.empresa_do_usuario_atual())::text);
create policy "planos - trocar da empresa" on storage.objects for update to authenticated
  using (bucket_id = 'planos-perfuracao' and (storage.foldername(name))[1] = (select public.empresa_do_usuario_atual())::text)
  with check (bucket_id = 'planos-perfuracao' and (storage.foldername(name))[1] = (select public.empresa_do_usuario_atual())::text);
create policy "planos - apagar da empresa" on storage.objects for delete to authenticated
  using (bucket_id = 'planos-perfuracao' and (storage.foldername(name))[1] = (select public.empresa_do_usuario_atual())::text);
