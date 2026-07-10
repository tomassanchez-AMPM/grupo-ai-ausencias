-- Datos semilla: catálogos reales + equipo de arranque.
-- Aplicada en Supabase como 20260710161450_datos_semilla
-- Los empleados de ejemplo (correos @ejemplo.ampm) se reemplazan por el
-- equipo real desde Administración → Empleados.

insert into paises (codigo, nombre, bandera, fin_de_semana, metodo_conteo) values
  ('NI', 'Nicaragua', '🇳🇮', '{0,6}', 'corridos_sin_feriados'),
  ('HN', 'Honduras', '🇭🇳', '{0,6}', 'laborables'),
  ('SV', 'El Salvador', '🇸🇻', '{0,6}', 'corridos'),
  ('PA', 'Panamá', '🇵🇦', '{0,6}', 'laborables');

insert into tipos_ausencia (id, nombre, descuenta_saldo, afecta_nomina, requiere_adjunto, tope_anual_dias, color, icono) values
  ('vacaciones', 'Vacaciones', true, false, false, null, '#0E9F6E', '🏖️'),
  ('enfermedad', 'Enfermedad / incapacidad', false, false, true, 15, '#D93025', '🤒'),
  ('permiso-personal', 'Permiso personal', false, false, false, 3, '#3F6AD8', '📋'),
  ('sin-goce', 'Permiso sin goce de sueldo', false, true, false, null, '#C27803', '⏸️'),
  ('licencia', 'Licencia (maternidad / luto)', false, false, false, null, '#7E3AF2', '🕊️');

insert into politicas_ausencia (id, nombre, pais, tipo_ausencia_id, metodo_acumulacion, dias_por_anio, reglas_antiguedad, tope_multiplicador, carryover_max_dias, carryover_expira) values
  ('pol-ni-vac', 'Vacaciones Nicaragua', 'NI', 'vacaciones', 'mensual', 30, '[]', 1.5, 15, null),
  ('pol-hn-vac', 'Vacaciones Honduras', 'HN', 'vacaciones', 'anual', 10,
   '[{"aPartirDeAnios":2,"diasExtra":2},{"aPartirDeAnios":3,"diasExtra":5},{"aPartirDeAnios":4,"diasExtra":10}]',
   null, 5, '{"mes":3,"dia":31}'),
  ('pol-sv-vac', 'Vacaciones El Salvador', 'SV', 'vacaciones', 'anual', 15, '[]', null, 0, null),
  ('pol-pa-vac', 'Vacaciones Panamá', 'PA', 'vacaciones', 'mensual', 30, '[]', null, 10, null);

-- Feriados 2026 de los 4 países (ver archivo aplicado para el detalle completo).
-- NI: 9 · HN: 10 · SV: 12 · PA: 10 — editables desde Administración → Feriados.
insert into feriados (pais, fecha, descripcion) values
  ('NI', '2026-01-01', 'Año Nuevo'), ('NI', '2026-04-02', 'Jueves Santo'),
  ('NI', '2026-04-03', 'Viernes Santo'), ('NI', '2026-05-01', 'Día del Trabajo'),
  ('NI', '2026-07-19', 'Día de la Revolución'), ('NI', '2026-09-14', 'Batalla de San Jacinto'),
  ('NI', '2026-09-15', 'Independencia'), ('NI', '2026-12-08', 'Inmaculada Concepción'),
  ('NI', '2026-12-25', 'Navidad'),
  ('HN', '2026-01-01', 'Año Nuevo'), ('HN', '2026-04-02', 'Jueves Santo'),
  ('HN', '2026-04-03', 'Viernes Santo'), ('HN', '2026-04-14', 'Día de las Américas'),
  ('HN', '2026-05-01', 'Día del Trabajo'), ('HN', '2026-09-15', 'Independencia'),
  ('HN', '2026-10-07', 'Feriado Morazánico'), ('HN', '2026-10-08', 'Feriado Morazánico'),
  ('HN', '2026-10-09', 'Feriado Morazánico'), ('HN', '2026-12-25', 'Navidad'),
  ('SV', '2026-01-01', 'Año Nuevo'), ('SV', '2026-04-01', 'Miércoles Santo'),
  ('SV', '2026-04-02', 'Jueves Santo'), ('SV', '2026-04-03', 'Viernes Santo'),
  ('SV', '2026-05-01', 'Día del Trabajo'), ('SV', '2026-08-03', 'Fiestas Agostinas'),
  ('SV', '2026-08-04', 'Fiestas Agostinas'), ('SV', '2026-08-05', 'Fiestas Agostinas'),
  ('SV', '2026-08-06', 'Fiestas Agostinas'), ('SV', '2026-09-15', 'Independencia'),
  ('SV', '2026-11-02', 'Día de los Difuntos'), ('SV', '2026-12-25', 'Navidad'),
  ('PA', '2026-01-01', 'Año Nuevo'), ('PA', '2026-01-09', 'Día de los Mártires'),
  ('PA', '2026-02-17', 'Martes de Carnaval'), ('PA', '2026-04-03', 'Viernes Santo'),
  ('PA', '2026-05-01', 'Día del Trabajo'), ('PA', '2026-11-03', 'Separación de Colombia'),
  ('PA', '2026-11-10', 'Primer Grito de Independencia'), ('PA', '2026-11-28', 'Independencia de España'),
  ('PA', '2026-12-08', 'Día de las Madres'), ('PA', '2026-12-25', 'Navidad');

-- Equipo de arranque: Tomás con su correo real (admin); el resto de ejemplo.
with pablo as (
  insert into empleados (nombre, email, pais, puesto, fecha_ingreso, manager_id, rol, avatar_color)
  values ('Pablo Andrade', 'pablo.andrade@ejemplo.ampm', 'NI', 'Director General', '2019-01-15', null, 'jefe', '#7E3AF2')
  returning id
), tomas as (
  insert into empleados (nombre, email, pais, puesto, fecha_ingreso, manager_id, rol, avatar_color)
  select 'Tomás Sánchez', 'tomas.sanchez@ampmcentroamerica.com', 'NI', 'CFO · RRHH', '2020-03-01', pablo.id, 'admin', '#0E9F6E'
  from pablo returning id
), gerentes as (
  insert into empleados (nombre, email, pais, puesto, fecha_ingreso, manager_id, rol, avatar_color)
  select v.nombre, v.email, v.pais, v.puesto, v.fecha_ingreso::date, pablo.id, 'jefe', v.color
  from pablo, (values
    ('Carla Mendoza', 'carla.mendoza@ejemplo.ampm', 'HN', 'Gerente País Honduras', '2021-06-01', '#C27803'),
    ('Diego Paredes', 'diego.paredes@ejemplo.ampm', 'SV', 'Gerente País El Salvador', '2022-02-14', '#E74694')
  ) as v(nombre, email, pais, puesto, fecha_ingreso, color)
  returning id, nombre
)
insert into empleados (nombre, email, pais, puesto, fecha_ingreso, manager_id, rol, avatar_color)
select v.nombre, v.email, v.pais, v.puesto, v.fecha_ingreso::date,
  case v.jefe
    when 'tomas' then (select id from tomas)
    when 'carla' then (select id from gerentes where nombre = 'Carla Mendoza')
    when 'diego' then (select id from gerentes where nombre = 'Diego Paredes')
  end,
  'empleado', v.color
from (values
  ('María López', 'maria.lopez@ejemplo.ampm', 'NI', 'Contadora Senior', '2021-09-01', 'tomas', '#3F6AD8'),
  ('Raúl Ortega', 'raul.ortega@ejemplo.ampm', 'NI', 'Analista de Datos', '2024-01-08', 'tomas', '#0694A2'),
  ('Jorge Castillo', 'jorge.castillo@ejemplo.ampm', 'HN', 'Analista Comercial', '2022-04-18', 'carla', '#D93025'),
  ('Lucía Ramírez', 'lucia.ramirez@ejemplo.ampm', 'HN', 'Coordinadora de Logística', '2023-08-21', 'carla', '#7E3AF2'),
  ('Andrés Flores', 'andres.flores@ejemplo.ampm', 'SV', 'Ejecutivo de Ventas', '2023-05-02', 'diego', '#C27803'),
  ('Sofía Guzmán', 'sofia.guzman@ejemplo.ampm', 'PA', 'Gerente de Marketing', '2022-11-07', 'diego', '#1D2C75')
) as v(nombre, email, pais, puesto, fecha_ingreso, jefe, color);
