-- Políticas definitivas decididas por Tomás (16-jul-2026):
--  · Acumulación: prorrateo mensual en TODOS los países.
--  · Carryover: SIN límite ni vencimiento (se elimina también el tope 1.5x de NI).
--  · Días por año y tipo de conteo: según la ley de cada país.
-- Aplicada en Supabase como politicas_decididas.

update politicas_ausencia
set metodo_acumulacion = 'mensual',
    carryover_max_dias = null,
    carryover_expira = null,
    tope_multiplicador = null
where tipo_ausencia_id = 'vacaciones';

-- Panamá por ley otorga 30 días CALENDARIO (un mes por 11 de trabajo):
-- el conteo pasa de laborables a corridos.
update paises set metodo_conteo = 'corridos' where codigo = 'PA';
