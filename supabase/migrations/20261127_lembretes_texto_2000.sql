alter table public.lembretes drop constraint if exists lembretes_texto_check;
alter table public.lembretes add constraint lembretes_texto_check check (char_length(texto) between 1 and 2000);
