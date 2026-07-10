-- Endurecimiento según advisors de Supabase.
-- Aplicada en Supabase como 20260710162552_endurecimiento_seguridad

-- 1) Las funciones auxiliares no deben ser invocables por anónimos.
revoke execute on function mi_empleado_id() from anon, public;
revoke execute on function soy_admin() from anon, public;
revoke execute on function soy_jefe_de(uuid) from anon, public;
revoke execute on function vincular_mi_usuario() from anon, public;
grant execute on function mi_empleado_id() to authenticated;
grant execute on function soy_admin() to authenticated;
grant execute on function soy_jefe_de(uuid) to authenticated;
grant execute on function vincular_mi_usuario() to authenticated;

-- 2) Notificaciones: solo se pueden crear ligadas a una solicitud en la que
-- el emisor participa (dueño, jefe del dueño o admin). Adiós al check(true).
drop policy notificaciones_crear on notificaciones;
create policy notificaciones_crear on notificaciones for insert to authenticated
  with check (
    mi_empleado_id() is not null
    and solicitud_id is not null
    and exists (
      select 1 from solicitudes s
      where s.id = solicitud_id
        and (s.empleado_id = mi_empleado_id() or soy_jefe_de(s.empleado_id) or soy_admin())
    )
  );
