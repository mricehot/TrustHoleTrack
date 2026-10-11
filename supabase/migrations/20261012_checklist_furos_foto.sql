-- Foto por furo do checklist (URL pública no bucket fotos-leque). Idempotente.
alter table public.checklist_furos add column if not exists foto_url text;
-- (O gatilho registrar_historico_checklist também passou a registrar mudanças de foto_url, como "foto".)
