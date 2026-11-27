alter table public.aneis add column if not exists tipo_area text not null default 'subterranea';
alter table public.aneis drop constraint if exists aneis_tipo_area_check;
alter table public.aneis add constraint aneis_tipo_area_check check (tipo_area in ('subterranea','ceu_aberto'));
alter table public.leques drop constraint if exists leque_tipo_check;
alter table public.leques drop constraint if exists leques_tipo_check;
alter table public.leques add constraint leques_tipo_check check (tipo in ('leque','slot','fill','cr','inv','aux','cava'));
