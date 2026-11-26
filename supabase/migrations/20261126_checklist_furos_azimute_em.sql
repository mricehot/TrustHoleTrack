alter table public.checklist_furos add column if not exists azimute_em timestamptz;
update public.checklist_furos set azimute_em = coalesce(perfilado_em, topografado_em, criado_em) where azimute_ok is true and azimute_em is null;
