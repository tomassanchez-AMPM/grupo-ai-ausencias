-- Multiempresa con gestión delegada (decisión de Tomás, 01-ago-2026):
-- catálogo de empresas + rol «gestor» (el BUM administra altas/bajas/ajustes
-- SOLO de su empresa). Las aprobaciones no cambian (siguen por jefe directo);
-- políticas y feriados siguen siendo por país. Candados del gestor impuestos
-- por RLS + trigger: no toca otras empresas, no mueve gente de empresa, no
-- otorga roles admin/gestor, no se edita a sí mismo, no toca auth_user_id,
-- y el jefe que asigna debe ser de su misma empresa.

-- 1) Catálogo de empresas
create table empresas (
  id text primary key,
  nombre text not null
);
alter table empresas enable row level security;
create policy empresas_lectura on empresas for select to authenticated using (true);
create policy empresas_insertar_admin on empresas for insert to authenticated with check (soy_admin());
create policy empresas_editar_admin on empresas for update to authenticated using (soy_admin()) with check (soy_admin());

insert into empresas (id, nombre) values
  ('ampm', 'AMPM'),
  ('infarma', 'INFARMA'),
  ('grupo-america', 'Grupo América'),
  ('rexsa', 'REXSA');

-- 2) Empresa en la ficha + rol «gestor»
alter table empleados add column empresa_id text references empresas(id);
update empleados set empresa_id = case
  when email like '%@grupoamerica.hn' then 'grupo-america'
  when email like '%@restauranteprimitivo.com' then 'rexsa'
  when email like '%infarma%' then 'infarma'
  else 'ampm' end;
alter table empleados alter column empresa_id set not null;
alter table empleados drop constraint empleados_rol_check;
alter table empleados add constraint empleados_rol_check
  check (rol = any (array['admin'::text, 'gestor'::text, 'jefe'::text, 'empleado'::text]));

-- 3) Funciones de apoyo
create or replace function soy_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empleados where auth_user_id = auth.uid() and rol = 'gestor' and activo);
$$;

create or replace function mi_empresa_id() returns text
language sql stable security definer set search_path = public as $$
  select empresa_id from empleados where auth_user_id = auth.uid();
$$;

create or replace function soy_gestor_de(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from empleados yo join empleados obj on obj.empresa_id = yo.empresa_id
    where yo.auth_user_id = auth.uid() and yo.rol = 'gestor' and yo.activo and obj.id = emp
  );
$$;

-- 4) Políticas de empleados: el gestor administra su empresa (sin tocarse a sí
--    mismo ni a admins/gestores); el admin de grupo sigue pudiendo todo.
drop policy empleados_insertar_admin on empleados;
create policy empleados_insertar on empleados for insert to authenticated
  with check (
    soy_admin()
    or (soy_gestor() and empresa_id = mi_empresa_id() and rol in ('empleado', 'jefe'))
  );

drop policy empleados_editar_admin on empleados;
create policy empleados_editar on empleados for update to authenticated
  using (
    soy_admin()
    or (soy_gestor() and empresa_id = mi_empresa_id() and id <> mi_empleado_id() and rol in ('empleado', 'jefe'))
  )
  with check (
    soy_admin()
    or (soy_gestor() and empresa_id = mi_empresa_id() and rol in ('empleado', 'jefe'))
  );

-- 5) Trigger: reglas que RLS no puede expresar (compara OLD vs NEW).
create or replace function reglas_empleado_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if soy_admin() or not soy_gestor() then
    return new; -- admin sin restricciones; vincular_mi_usuario y otros flujos, intactos
  end if;
  if tg_op = 'INSERT' then
    if new.auth_user_id is not null then
      raise exception 'El acceso se vincula cuando la persona inicia sesión, no en el alta';
    end if;
  else
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'No puedes mover empleados a otra empresa';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No puedes cambiar el acceso vinculado de un empleado';
    end if;
  end if;
  if new.rol not in ('empleado', 'jefe') then
    raise exception 'Solo el administrador del grupo otorga roles de administración';
  end if;
  if new.manager_id is null then
    raise exception 'Asigna un jefe (aprobador) al empleado';
  end if;
  if (select empresa_id from empleados where id = new.manager_id) is distinct from mi_empresa_id() then
    raise exception 'El jefe asignado debe ser de tu misma empresa';
  end if;
  return new;
end $$;

create trigger tg_reglas_empleado_gestor
  before insert or update on empleados
  for each row execute function reglas_empleado_gestor();

-- 6) Ajustes de saldo: el gestor puede ajustar a su gente (nunca a sí mismo)
--    y necesita LEER los ajustes de su empresa para que los saldos que ve
--    estén completos. Igual con las solicitudes (solo lectura).
drop policy ajustes_crear_admin on ajustes_saldo;
create policy ajustes_crear on ajustes_saldo for insert to authenticated
  with check (soy_admin() or (soy_gestor_de(empleado_id) and empleado_id <> mi_empleado_id()));

drop policy ajustes_lectura on ajustes_saldo;
create policy ajustes_lectura on ajustes_saldo for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_jefe_de(empleado_id) or soy_admin() or soy_gestor_de(empleado_id));

drop policy solicitudes_lectura on solicitudes;
create policy solicitudes_lectura on solicitudes for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_jefe_de(empleado_id) or soy_admin() or soy_gestor_de(empleado_id));

grant execute on function soy_gestor() to authenticated;
grant execute on function mi_empresa_id() to authenticated;
grant execute on function soy_gestor_de(uuid) to authenticated;

-- 7) Designaciones iniciales: los BUM como gestores de su empresa.
update empleados set rol = 'gestor' where email = 'carolina.rodriguez@grupoamerica.hn';
update empleados set rol = 'gestor' where email = 'federico.storino@restauranteprimitivo.com';
