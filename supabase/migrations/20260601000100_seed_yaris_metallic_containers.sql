-- Marca los 17 tachos Airkem dedicados a Yaris (provistos por operaciones).
update public.containers set is_yaris_dedicated = true
where id in (
  'A-020','A-042','A-044','A-046','A-048','A-051','A-064','A-065',
  'A-068','A-069','A-072','A-076','A-078','A-105','A-154','A-175','A-187'
);

-- Inserta los 15 tachos metálicos M1..M15 (120 L, sin empresa, taras reales).
insert into public.containers (id, company_id, size_liters, tare_weight_kg, status, is_metallic_dedicated)
values
  ('M1',  null, '120', 8.7, 'active', true),
  ('M2',  null, '120', 8.7, 'active', true),
  ('M3',  null, '120', 8.9, 'active', true),
  ('M4',  null, '120', 8.9, 'active', true),
  ('M5',  null, '120', 9.1, 'active', true),
  ('M6',  null, '120', 9.0, 'active', true),
  ('M7',  null, '120', 9.0, 'active', true),
  ('M8',  null, '120', 8.8, 'active', true),
  ('M9',  null, '120', 9.2, 'active', true),
  ('M10', null, '120', 9.2, 'active', true),
  ('M11', null, '120', 9.1, 'active', true),
  ('M12', null, '120', 8.7, 'active', true),
  ('M13', null, '120', 8.9, 'active', true),
  ('M14', null, '120', 8.7, 'active', true),
  ('M15', null, '120', 9.1, 'active', true)
on conflict (id) do nothing;
