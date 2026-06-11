-- Rol de la foto dentro de su evento. Para recorrido: 'dirty' | 'clean'.
-- Null para pesaje (posicional balanza/tacho) y resto de eventos.
alter table public.photos add column role text;

comment on column public.photos.role is
  'Rol de la foto en su evento. Recorrido: dirty|clean. Null en otros eventos.';
