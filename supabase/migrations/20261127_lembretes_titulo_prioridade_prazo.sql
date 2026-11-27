alter table public.lembretes add column if not exists titulo text check (titulo is null or char_length(titulo) <= 200);
alter table public.lembretes add column if not exists prioridade text not null default 'normal' check (prioridade in ('alta','normal','baixa'));
alter table public.lembretes add column if not exists prazo date;
