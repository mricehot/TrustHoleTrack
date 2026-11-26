alter table public.aneis add column if not exists arquivos_ok boolean not null default false, add column if not exists arquivos_ok_em timestamptz, add column if not exists arquivos_ok_por text;
