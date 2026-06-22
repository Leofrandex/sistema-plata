-- ─────────────────────────────────────────────────────────────────────────────
-- Directorio público de login: alimenta las tarjetas de usuario en /login.
-- La pantalla de login es anónima, por eso la vista es legible por `anon`.
-- Expone SOLO id, name, role, email (correos sintéticos internos). Tradeoff
-- aceptado en el diseño: cualquiera que abra la app ve el roster (sin contraseñas).
-- security_invoker = false → la vista corre con privilegios del owner para poder
-- leer auth.users y saltar el RLS de profiles para el rol anónimo.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.login_directory
with (security_invoker = false) as
  select p.id, p.name, p.role, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(u.email, '') not like 'demo@%'
  order by p.role, p.name;

grant select on public.login_directory to anon, authenticated;
