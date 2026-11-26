alter table public.tratativa_envios add column if not exists leque_ids text[] not null default '{}';
