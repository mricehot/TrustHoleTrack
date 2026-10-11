-- Orientação do realce (ascendente/descendente). Os leques novos herdam esse valor.
alter table public.aneis add column if not exists orientacao text not null default 'descendente' check (orientacao in ('ascendente','descendente'));
