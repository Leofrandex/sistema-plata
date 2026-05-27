-- Multi-andén por horario: un mismo (date, slot) de andén puede tener varios
-- route_events (uno por andén). Se elimina el índice único parcial que limitaba
-- a un solo recorrido de andén por horario/día.
drop index if exists public.route_events_anden_unique_date_slot;
