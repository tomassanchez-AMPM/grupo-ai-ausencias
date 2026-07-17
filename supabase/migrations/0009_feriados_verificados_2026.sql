-- Feriados 2026 verificados por investigación legal multi-agente (sector
-- privado, capitales: Managua, Tegucigalpa, San Salvador, Ciudad de Panamá).
-- Fuentes: Códigos de Trabajo NI/HN/SV/PA, Ley 1272 (NI), Decretos 50-2003
-- y 78-2015 (HN), Ley 291-2022 (PA), comunicados MITRAB/COHEP/MTPS/MITRADEL.
-- Fechas OBSERVADAS (ya corridas donde la ley lo ordena). Los feriados se
-- cargan año a año desde Administración → Feriados.
-- Aplicada en Supabase como feriados_verificados_2026 (ver SQL completo ahí).

alter table feriados add column medio_dia boolean not null default false;
-- + delete e insert de las 52 filas verificadas (15 NI, 12 HN, 13 SV, 12 PA;
--   medios días: HN 2026-10-07 y 2026-10-10, Feriado Morazánico).
