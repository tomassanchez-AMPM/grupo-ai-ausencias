-- Funciones auxiliares + políticas RLS (reglas de visibilidad de la sección 3.1)
-- Aplicada en Supabase como 20260710161407_funciones_y_rls

create or replace function mi_empleado_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from empleados where auth_user_id = auth.uid()
$$;

create or replace function soy_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from empleados
    where auth_user_id = auth.uid() and rol = 'admin' and activo
  )
$$;

create or replace function soy_jefe_de(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from empleados
    where id = emp and manager_id = mi_empleado_id()
  )
$$;

-- Vincula el usuario de Auth con su fila de empleados por correo (primer login)
-- y devuelve la fila del empleado activo.
create or replace function vincular_mi_usuario() returns setof empleados
language plpgsql security definer set search_path = public as $$
begin
  update empleados
    set auth_user_id = auth.uid()
  where lower(email) = lower(coalesce(auth.email(), ''))
    and auth_user_id is null
    and activo;
  return query select * from empleados where auth_user_id = auth.uid() and activo;
end $$;

alter table paises             enable row level security;
alter table tipos_ausencia     enable row level security;
alter table politicas_ausencia enable row level security;
alter table feriados           enable row level security;
alter table empleados          enable row level security;
alter table solicitudes        enable row level security;
alter table ajustes_saldo      enable row level security;
alter table compensaciones     enable row level security;
alter table auditoria          enable row level security;
alter table notificaciones     enable row level security;

-- Catálogos: lectura autenticada; escritura solo admin.
create policy paises_lectura on paises for select to authenticated using (true);
create policy tipos_lectura on tipos_ausencia for select to authenticated using (true);
create policy tipos_insertar_admin on tipos_ausencia for insert to authenticated with check (soy_admin());
create policy tipos_editar_admin on tipos_ausencia for update to authenticated using (soy_admin()) with check (soy_admin());
create policy politicas_lectura on politicas_ausencia for select to authenticated using (true);
create policy feriados_lectura on feriados for select to authenticated using (true);
create policy feriados_insertar_admin on feriados for insert to authenticated with check (soy_admin());
create policy feriados_eliminar_admin on feriados for delete to authenticated using (soy_admin());

-- Empleados: directorio visible para autenticados; escribe solo admin.
create policy empleados_lectura on empleados for select to authenticated using (true);
create policy empleados_insertar_admin on empleados for insert to authenticated with check (soy_admin());
create policy empleados_editar_admin on empleados for update to authenticated using (soy_admin()) with check (soy_admin());

-- Solicitudes: propias, de mi equipo directo, o todas si soy admin.
create policy solicitudes_lectura on solicitudes for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_jefe_de(empleado_id) or soy_admin());
create policy solicitudes_crear on solicitudes for insert to authenticated
  with check (empleado_id = mi_empleado_id() and estado = 'pendiente');
create policy solicitudes_actualizar on solicitudes for update to authenticated
  using (empleado_id = mi_empleado_id() or soy_jefe_de(empleado_id) or soy_admin());

-- Ajustes: los ve el dueño, su jefe y el admin; solo crea el admin.
create policy ajustes_lectura on ajustes_saldo for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_jefe_de(empleado_id) or soy_admin());
create policy ajustes_crear_admin on ajustes_saldo for insert to authenticated with check (soy_admin());

-- Compensación: SOLO admin ve todas; cada quien la propia. El jefe NO.
create policy compensacion_lectura on compensaciones for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_admin());
create policy compensacion_crear_admin on compensaciones for insert to authenticated with check (soy_admin());

-- Auditoría: inserta el propio actor; lee solo admin. Sin update/delete: inmutable.
create policy auditoria_insertar on auditoria for insert to authenticated
  with check (actor_id = mi_empleado_id());
create policy auditoria_lectura_admin on auditoria for select to authenticated using (soy_admin());

-- Notificaciones: cada quien las suyas.
create policy notificaciones_lectura on notificaciones for select to authenticated
  using (para_id = mi_empleado_id());
create policy notificaciones_crear on notificaciones for insert to authenticated with check (true);
create policy notificaciones_marcar on notificaciones for update to authenticated
  using (para_id = mi_empleado_id()) with check (para_id = mi_empleado_id());

-- Tiempo real para la campana de notificaciones.
alter publication supabase_realtime add table notificaciones;
