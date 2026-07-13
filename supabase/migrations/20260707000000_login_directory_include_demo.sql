-- ─────────────────────────────────────────────────────────────────────────────
-- login_directory: dejar de excluir los correos `demo@%`.
-- La cuenta demo pasó a ser un operador de uso real (2026-07-06), así que debe
-- aparecer como tarjeta en /login igual que el resto. Antes se ocultaba por ser
-- cuenta de pruebas. Reemplaza el filtro de 20260619000000_login_directory_view.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.login_directory
with (security_invoker = false) as
  select p.id, p.name, p.role, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.role, p.name;

grant select on public.login_directory to anon, authenticated;
