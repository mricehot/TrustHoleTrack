-- Metragem esperada por furo no checklist e motivo da obstrução (rocha, tela, água, desvio...).
alter table public.checklist_furos add column if not exists metragem_esperada numeric;
alter table public.checklist_furos add column if not exists obstruido_motivo text;
