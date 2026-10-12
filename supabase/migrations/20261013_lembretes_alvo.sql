-- Lembrete ligado a um leque ou furo do checklist (rotulo guardado para aparecer mesmo offline/apagado).
alter table public.lembretes add column if not exists alvo_tipo text check (alvo_tipo in ('leque','furo'));
alter table public.lembretes add column if not exists alvo_id text;
alter table public.lembretes add column if not exists alvo_rotulo text;
