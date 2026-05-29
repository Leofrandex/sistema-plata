-- 2026-05-29: empresa seleccionada en el recorrido (para reporte por institución)
alter table public.route_events
  add column company_id uuid null references public.companies(id);
