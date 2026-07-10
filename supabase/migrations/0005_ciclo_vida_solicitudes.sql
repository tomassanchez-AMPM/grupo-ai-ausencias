-- Cierra la auto-aprobación vía REST detectada en la auditoría de seguridad.
-- Aplicada en Supabase como ciclo_vida_solicitudes.

-- 1) El dueño solo puede cancelar su solicitud pendiente; aprobar/rechazar es
--    exclusivo del jefe directo o admin, y solo sobre pendientes.
drop policy solicitudes_actualizar on solicitudes;

create policy solicitudes_cancelar_propia on solicitudes for update to authenticated
  using (empleado_id = mi_empleado_id() and estado = 'pendiente')
  with check (empleado_id = mi_empleado_id() and estado in ('pendiente', 'cancelada'));

create policy solicitudes_resolver_aprobador on solicitudes for update to authenticated
  using ((soy_jefe_de(empleado_id) or soy_admin()) and estado = 'pendiente')
  with check ((soy_jefe_de(empleado_id) or soy_admin()) and estado in ('aprobada', 'rechazada'));

-- 2) Los campos que definen el costo de la solicitud quedan congelados al
--    crearla (RLS no compara OLD vs NEW; esto requiere trigger).
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
  return new;
end $$;

create trigger tg_bloquear_campos_solicitud
  before update on solicitudes
  for each row execute function bloquear_campos_solicitud();

-- 3) Auditoría de solicitudes generada por la base: registra también las
--    mutaciones hechas por REST directo, y no es falsificable desde el cliente.
create or replace function auditar_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nombre_emp text;
  nombre_tipo text;
  nombre_pol text;
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
    insert into auditoria (actor_id, accion, entidad, entidad_id, detalle)
    values (mi_empleado_id(),
      case new.estado when 'aprobada' then 'aprobó' when 'rechazada' then 'rechazó'
        when 'cancelada' then 'canceló' else 'actualizó' end,
      'solicitud', new.id::text,
      format('%s de %s (%s medios días)%s', nombre_tipo, nombre_emp, new.medio_dias,
        coalesce(' — política ' || nombre_pol, '')));
  end if;
  return new;
end $$;

create trigger tg_auditar_solicitud
  after insert or update on solicitudes
  for each row execute function auditar_solicitud();
