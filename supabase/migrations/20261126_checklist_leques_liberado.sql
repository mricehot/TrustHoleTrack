-- Leque liberado manualmente para tratar (mesmo sem completar perfilagem/topografia/azimute)
alter table public.checklist_leques
  add column if not exists liberado_tratamento boolean not null default false,
  add column if not exists liberado_em timestamptz,
  add column if not exists liberado_por text;
