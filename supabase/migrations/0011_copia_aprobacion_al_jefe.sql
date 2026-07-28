-- Copia informativa de gobernanza (pedido de Tomás, 27-jul-2026):
-- cuando un aprobador autoriza una ausencia, su PROPIO jefe recibe una
-- notificación (campanita + correo vía la tubería existente). Hoy eso
-- significa: Pablo (CEO) aprueba → Tomás (su contrafirma) se entera.
-- Tomás no tiene jefe registrado, así que sus aprobaciones no generan copia.
-- Se implementa como trigger para cubrir también aprobaciones vía REST.

create or replace function avisar_aprobacion_al_jefe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  aprobador_id uuid;
  jefe_id uuid;
  nombre_aprobador text;
  nombre_emp text;
  nombre_tipo text;
  dias text;
begin
  if new.estado <> 'aprobada' or old.estado is not distinct from new.estado then
    return new;
  end if;
  -- El actor real de la sesión es más confiable que new.aprobador_id.
  aprobador_id := coalesce(mi_empleado_id(), new.aprobador_id);
  if aprobador_id is null then return new; end if;

  select manager_id, nombre into jefe_id, nombre_aprobador from empleados where id = aprobador_id;
  -- Sin jefe no hay copia; tampoco si el jefe es el propio solicitante
  -- (ya recibe su aviso de "aprobó tu solicitud") o el mismo aprobador.
  if jefe_id is null or jefe_id = new.empleado_id or jefe_id = aprobador_id then
    return new;
  end if;

  select nombre into nombre_emp from empleados where id = new.empleado_id;
  select nombre into nombre_tipo from tipos_ausencia where id = new.tipo_ausencia_id;
  dias := case when new.medio_dias % 2 = 0
    then (new.medio_dias / 2)::text
    else (new.medio_dias / 2)::text || '.5' end;

  insert into notificaciones (para_id, mensaje, solicitud_id)
  values (jefe_id,
    format('Copia informativa: %s aprobó %s de %s, del %s al %s (%s días).',
      nombre_aprobador, nombre_tipo, nombre_emp, new.fecha_inicio, new.fecha_fin, dias),
    new.id);
  return new;
end $$;

create trigger tg_avisar_aprobacion_al_jefe
  after update on solicitudes
  for each row execute function avisar_aprobacion_al_jefe();
