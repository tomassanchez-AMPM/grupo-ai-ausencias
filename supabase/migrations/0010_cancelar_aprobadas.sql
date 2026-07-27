-- Cancelación de solicitudes aprobadas (decisión 21-jul-2026):
-- patrón cancelar-y-recrear — una aprobada nunca se edita en sitio; el jefe
-- directo o un admin la cancela con motivo obligatorio y, si hacen falta
-- fechas nuevas, se crea otra solicitud por el flujo normal. Los días
-- regresan solos al saldo porque el saldo se calcula, no se guarda.

-- 1) RLS: el aprobador ahora también puede actuar sobre aprobadas. Las
--    transiciones exactas las valida el trigger (RLS no compara OLD vs NEW).
drop policy solicitudes_resolver_aprobador on solicitudes;

create policy solicitudes_resolver_aprobador on solicitudes for update to authenticated
  using ((soy_jefe_de(empleado_id) or soy_admin()) and estado in ('pendiente', 'aprobada'))
  with check ((soy_jefe_de(empleado_id) or soy_admin()) and estado in ('aprobada', 'rechazada', 'cancelada'));

-- 2) El trigger de campos congelados ahora también es la máquina de estados:
--    pendiente → aprobada | rechazada | cancelada
--    aprobada  → cancelada (motivo obligatorio en comentario_aprobador)
--    rechazada y cancelada son terminales; lo resuelto no se edita.
create or replace function bloquear_campos_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.empleado_id is distinct from old.empleado_id then
    raise exception 'No se puede cambiar el dueño de una solicitud';
  end if;
  if not soy_admin() and (
    new.medio_dias is distinct from old.medio_dias
    or new.fecha_inicio is distinct from old.fecha_inicio
    or new.fecha_fin is distinct from old.fecha_fin
    or new.fraccion_inicio is distinct from old.fraccion_inicio
    or new.fraccion_fin is distinct from old.fraccion_fin
    or new.tipo_ausencia_id is distinct from old.tipo_ausencia_id
  ) then
    raise exception 'Los campos de la solicitud quedan congelados al crearla';
  end if;
  if new.estado is distinct from old.estado then
    if old.estado = 'pendiente' and new.estado in ('aprobada', 'rechazada', 'cancelada') then
      null;
    elsif old.estado = 'aprobada' and new.estado = 'cancelada' then
      if new.comentario_aprobador is null or btrim(new.comentario_aprobador) = '' then
        raise exception 'Cancelar una solicitud aprobada requiere un motivo';
      end if;
    else
      raise exception 'Transición de estado no permitida: % → %', old.estado, new.estado;
    end if;
  elsif old.estado <> 'pendiente' then
    raise exception 'Una solicitud resuelta no se edita; cancélala y crea una nueva';
  end if;
  return new;
end $$;

-- 3) Auditoría: al cancelar una aprobada, deja constancia del motivo.
create or replace function auditar_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nombre_emp text;
  nombre_tipo text;
  nombre_pol text;
  sufijo text := '';
begin
  select nombre into nombre_emp from empleados where id = new.empleado_id;
  select nombre into nombre_tipo from tipos_ausencia where id = new.tipo_ausencia_id;
  if tg_op = 'INSERT' then
    insert into auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (mi_empleado_id(), 'creó', 'solicitud', new.id::text,
      format('%s de %s: %s → %s (%s medios días)', nombre_tipo, nombre_emp, new.fecha_inicio, new.fecha_fin, new.medio_dias));
  elsif new.estado is distinct from old.estado then
    select p.nombre into nombre_pol
    from politicas_ausencia p join empleados e on e.id = new.empleado_id
    where p.pais = e.pais and p.tipo_ausencia_id = new.tipo_ausencia_id;
    if old.estado = 'aprobada' and new.estado = 'cancelada' then
      sufijo := format(' — estaba aprobada; motivo: %s', coalesce(new.comentario_aprobador, ''));
    end if;
    insert into auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (mi_empleado_id(),
      case new.estado when 'aprobada' then 'aprobó' when 'rechazada' then 'rechazó'
        when 'cancelada' then 'canceló' else 'actualizó' end,
      'solicitud', new.id::text,
      format('%s de %s (%s medios días)%s%s', nombre_tipo, nombre_emp, new.medio_dias,
        coalesce(' — política ' || nombre_pol, ''), sufijo));
  end if;
  return new;
end $$;
