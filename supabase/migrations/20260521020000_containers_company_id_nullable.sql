-- Permite envases sin empresa asignada — necesario para el piloto 2026-05-21:
-- los 189 envases del catálogo se cargan sin cliente/empresa.
alter table public.containers alter column company_id drop not null;
