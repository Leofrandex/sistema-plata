-- Inserta los 26 contenedores de la flota Yaris (Y1..Y26): 1100 L, sin empresa,
-- sin tara (se pesan con los tachos alternativos is_yaris_dedicated).
insert into public.containers (id, company_id, size_liters, tare_weight_kg, status, is_yaris_container)
select
  'Y' || n,
  null,
  '1100',
  0,
  'active',
  true
from generate_series(1, 26) as n
on conflict (id) do nothing;
