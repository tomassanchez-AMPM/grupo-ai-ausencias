-- Suite de pruebas de Planilla · Fase 1. Corre contra la base real dentro de
-- una transacción y TODO se revierte: el éxito es el error final
-- «ROLLBACK_TESTS_OK n/n». Cualquier otro mensaje es una falla.
-- Simula sesiones reales cambiando el rol y los claims del JWT (sub, aal).
do $$
declare
  u_jhonny uuid; u_tomas uuid; u_gerald uuid;       -- auth.users
  e_jhonny uuid; e_tomas uuid; e_gerald uuid;       -- empleados
  v_clase uuid; v_banco uuid; v_sol uuid; v_sol2 uuid; v_txt text; v_j jsonb; v_n int;
  ok int := 0; total int := 0; fallos text := '';
  alta jsonb;
begin
  select auth_user_id, id into u_jhonny, e_jhonny from public.empleados where email = 'jhonny.vasquez@infarma.hn';
  select auth_user_id, id into u_tomas, e_tomas from public.empleados where email = 'tomas.sanchez@ampmcentroamerica.com';
  select auth_user_id, id into u_gerald, e_gerald from public.empleados where email = 'gerald.rocha@ampmcentroamerica.com';
  select id into v_banco from planilla.cat_bancos where nombre = 'Banco LAFISE Panamá';

  -- ── T1: sin permiso (Gerald, con segundo factor) ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_gerald, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin
    if (public.pla_mi_acceso() ->> 'tiene_acceso')::boolean then raise exception 'acceso indebido'; end if;
    perform public.pla_fichas();
    fallos := fallos || ' | T1 no bloqueó';
  exception when others then
    if sqlerrm like 'PLA_PERMISO%' then ok := ok + 1; else fallos := fallos || ' | T1: ' || sqlerrm; end if;
  end;

  -- ── T2: con permiso pero SIN segundo factor (Jhonny aal1) ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.pla_fichas();
    fallos := fallos || ' | T2 no exigió segundo factor';
  exception when others then
    if sqlerrm like 'PLA_MFA%' then ok := ok + 1; else fallos := fallos || ' | T2: ' || sqlerrm; end if;
  end;

  -- ── T3: acceso directo al esquema privado desde un usuario autenticado ──
  total := total + 1;
  begin
    execute 'select count(*) from planilla.fichas' into v_n;
    fallos := fallos || ' | T3 leyó el esquema privado';
  exception when insufficient_privilege then ok := ok + 1;
    when others then fallos := fallos || ' | T3: ' || sqlerrm;
  end;

  -- ── T4: anónimo no puede ni invocar las funciones ──
  total := total + 1;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.pla_mi_acceso();
    fallos := fallos || ' | T4 anónimo ejecutó función';
  exception when insufficient_privilege then ok := ok + 1;
    when others then fallos := fallos || ' | T4: ' || sqlerrm;
  end;
  execute 'reset role';

  -- ── T5: catálogos solo los administra el admin de planilla ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.pla_clase_guardar(null, 'Clase pirata');
    fallos := fallos || ' | T5 preparador creó clase';
  exception when others then
    if sqlerrm like 'PLA_PERMISO%' then ok := ok + 1; else fallos := fallos || ' | T5: ' || sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.pla_clase_guardar(null, 'PRUEBA Corporativo');
  execute 'reset role';
  select id into v_clase from planilla.cat_clases where nombre = 'PRUEBA Corporativo';

  alta := jsonb_build_object(
    'general', jsonb_build_object('legislacion', 'NI', 'frecuencia_pago', 'mensual', 'moneda', 'USD',
               'fecha_ingreso_original', '2024-05-01'),
    'compensacion', jsonb_build_array(
        jsonb_build_object('concepto_id', 'salario_base', 'monto', 2000, 'moneda', 'USD'),
        jsonb_build_object('concepto_id', 'viatico', 'monto', 300, 'moneda', 'USD')),
    'pagadores', jsonb_build_array(jsonb_build_object('empresa_id', 'clovertale', 'porcentaje', 100)),
    'clases', jsonb_build_array(jsonb_build_object('clase_id', v_clase, 'porcentaje', 100)),
    'cuenta', jsonb_build_object('banco_id', v_banco, 'tipo_cuenta', 'ahorro', 'moneda', 'USD', 'titular', 'Gerald Rocha'));

  -- ── T6: validaciones bloqueantes del alta ──
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  total := total + 1;
  begin
    perform public.pla_solicitud_crear(e_gerald, 'alta',
      jsonb_set(alta, '{pagadores}', jsonb_build_array(jsonb_build_object('empresa_id', 'clovertale', 'porcentaje', 90))),
      current_date, 'prueba', '001234567890');
    fallos := fallos || ' | T6a aceptó pagadores al 90 %';
  exception when others then
    if sqlerrm like '%deben sumar 100%' then ok := ok + 1; else fallos := fallos || ' | T6a: ' || sqlerrm; end if;
  end;
  total := total + 1;
  begin
    perform public.pla_solicitud_crear(e_gerald, 'alta',
      jsonb_set(alta, '{compensacion}', jsonb_build_array(jsonb_build_object('concepto_id', 'viatico', 'monto', 300, 'moneda', 'USD'))),
      current_date, 'prueba', '001234567890');
    fallos := fallos || ' | T6b aceptó alta sin salario base';
  exception when others then
    if sqlerrm like '%salario base%' then ok := ok + 1; else fallos := fallos || ' | T6b: ' || sqlerrm; end if;
  end;
  total := total + 1;
  begin
    perform public.pla_solicitud_crear(e_gerald, 'alta', alta, current_date, 'prueba', '12');
    fallos := fallos || ' | T6c aceptó cuenta inválida';
  exception when others then
    if sqlerrm like '%número de cuenta%' then ok := ok + 1; else fallos := fallos || ' | T6c: ' || sqlerrm; end if;
  end;
  total := total + 1;
  begin
    perform public.pla_solicitud_crear(e_gerald, 'alta', alta, current_date, '   ', '001234567890');
    fallos := fallos || ' | T6d aceptó cambio sin motivo';
  exception when others then
    if sqlerrm like '%motivo%' then ok := ok + 1; else fallos := fallos || ' | T6d: ' || sqlerrm; end if;
  end;

  -- ── T7: alta correcta + aviso al aprobador + una sola abierta ──
  total := total + 1;
  v_sol := public.pla_solicitud_crear(e_gerald, 'alta', alta, current_date - 30, 'Carga inicial de prueba', '0012-3456-7890');
  begin
    perform public.pla_solicitud_crear(e_gerald, 'alta', alta, current_date, 'duplicada', '001234567890');
    fallos := fallos || ' | T7 permitió dos altas abiertas';
  exception when others then
    if sqlerrm like '%solicitud pendiente%' then ok := ok + 1; else fallos := fallos || ' | T7: ' || sqlerrm; end if;
  end;
  execute 'reset role';
  total := total + 1;
  if exists (select 1 from public.notificaciones where para_id = e_tomas and mensaje like 'Planilla: hay una solicitud%')
     and not exists (select 1 from public.notificaciones where mensaje like 'Planilla:%' and mensaje ~ '[0-9]{4,}') then
    ok := ok + 1; else fallos := fallos || ' | T7b aviso al aprobador ausente o con datos'; end if;

  -- ── T8: el número de cuenta nunca queda en claro ──
  total := total + 1;
  select count(*) into v_n from planilla.solicitudes_cambio s
   where s.id = v_sol and (s.payload::text like '%001234567890%' or s.secreto_cifrado is null
     or encode(s.secreto_cifrado, 'escape') like '%001234567890%');
  if v_n = 0 and (select payload #>> '{cuenta,ultimos4}' from planilla.solicitudes_cambio where id = v_sol) = '7890'
     and not exists (select 1 from planilla.bitacora b where b::text like '%001234567890%') then
    ok := ok + 1; else fallos := fallos || ' | T8 número de cuenta expuesto'; end if;

  -- ── T9: el preparador no aprueba (no tiene el nivel) ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.pla_solicitud_resolver(v_sol, true, null);
    fallos := fallos || ' | T9 preparador aprobó';
  exception when others then
    if sqlerrm like 'PLA_PERMISO%' then ok := ok + 1; else fallos := fallos || ' | T9: ' || sqlerrm; end if;
  end;

  -- ── T10: el aprobador revisa la cuenta propuesta (queda registrado) y aprueba ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_txt := public.pla_revelar_cuenta(null, v_sol, 'Verificar cuenta antes de aprobar');
  perform public.pla_solicitud_resolver(v_sol, true, null);
  v_j := public.pla_fichas();
  execute 'reset role';
  if v_txt = '001234567890'
     and exists (select 1 from planilla.bitacora where operacion = 'REVELAR' and actor_empleado = e_tomas)
     and exists (select 1 from planilla.fichas where empleado_id = e_gerald)
     and (select count(*) from planilla.compensacion where empleado_id = e_gerald and vigente_hasta is null) = 2
     and (select ultimos4 from planilla.cuentas_bancarias where empleado_id = e_gerald) = '7890'
     and (select secreto_cifrado is null and estado = 'aprobada' from planilla.solicitudes_cambio where id = v_sol)
     and jsonb_array_length(v_j) = 1 and v_j -> 0 -> 'cuenta' ->> 'ultimos4' = '7890'
     and (v_j -> 0)::text not like '%001234567890%' then
    ok := ok + 1; else fallos := fallos || ' | T10 alta aprobada incompleta'; end if;

  -- ── T11: la bitácora registra actor, origen y motivo ──
  total := total + 1;
  if exists (select 1 from planilla.bitacora where tabla = 'fichas' and operacion = 'INSERT'
       and actor_empleado = e_tomas and origen = 'pla_solicitud_resolver' and motivo = 'Carga inicial de prueba') then
    ok := ok + 1; else fallos := fallos || ' | T11 bitácora sin actor/origen/motivo'; end if;

  -- ── T12: doble control — quien propone no resuelve, aunque tenga el nivel ──
  total := total + 1;
  insert into planilla.permisos (empleado_id, nivel) values (e_jhonny, 'aprobacion');
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  v_sol2 := public.pla_solicitud_crear(e_gerald, 'compensacion',
    jsonb_build_array(jsonb_build_object('concepto_id', 'salario_base', 'monto', 2500, 'moneda', 'USD')),
    current_date, 'Aumento de prueba');
  begin
    perform public.pla_solicitud_resolver(v_sol2, true, null);
    fallos := fallos || ' | T12 se autoaprobó';
  exception when others then
    if sqlerrm like 'Doble control: no puedes resolver una solicitud que tú propusiste%' then ok := ok + 1;
    else fallos := fallos || ' | T12: ' || sqlerrm; end if;
  end;

  -- ── T13: vigencia — no se insertan versiones en medio del historial ──
  total := total + 1;
  begin
    perform public.pla_solicitud_crear(e_gerald, 'pagadores',
      jsonb_build_array(jsonb_build_object('empresa_id', 'clovertale', 'porcentaje', 100)),
      current_date - 60, 'Vigencia anterior a la versión actual');
    fallos := fallos || ' | T13 aceptó vigencia en medio del historial';
  exception when others then
    if sqlerrm like '%posterior a la última versión%' then ok := ok + 1; else fallos := fallos || ' | T13: ' || sqlerrm; end if;
  end;

  -- ── T14: al aprobar, la versión anterior se cierra y nada se sobrescribe ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.pla_solicitud_resolver(v_sol2, true, 'ok');
  v_j := public.pla_ficha_historial(e_gerald);
  execute 'reset role';
  if (select count(*) from planilla.compensacion where empleado_id = e_gerald) = 3
     and (select count(*) from planilla.compensacion where empleado_id = e_gerald and vigente_hasta = current_date - 1) = 2
     and (select monto from planilla.compensacion where empleado_id = e_gerald and vigente_hasta is null) = 2500
     and jsonb_array_length(v_j -> 'compensacion') = 3 then
    ok := ok + 1; else fallos := fallos || ' | T14 historial de compensación incorrecto'; end if;

  -- ── T15: nadie resuelve cambios sobre su propia ficha ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  v_sol := public.pla_solicitud_crear(e_tomas, 'alta', alta - 'cuenta', current_date, 'Alta del aprobador');
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.pla_solicitud_resolver(v_sol, true, null);
    fallos := fallos || ' | T15 aprobó su propia ficha';
  exception when others then
    if sqlerrm like 'Doble control: no puedes resolver cambios sobre tu propia ficha%' then ok := ok + 1;
    else fallos := fallos || ' | T15: ' || sqlerrm; end if;
  end;

  -- ── T16: cambio de cuenta — rechazo exige motivo; al aprobar se avisa al titular ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  v_sol2 := public.pla_solicitud_crear(e_gerald, 'cuenta',
    jsonb_build_object('banco_id', v_banco, 'tipo_cuenta', 'corriente', 'moneda', 'USD', 'titular', 'Gerald Rocha'),
    current_date, 'Cambio de cuenta de prueba', '9999000011112222');
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.pla_solicitud_resolver(v_sol2, false, '  ');
    fallos := fallos || ' | T16 rechazó sin motivo';
  exception when others then
    if sqlerrm like '%motivo del rechazo%' then ok := ok + 1; else fallos := fallos || ' | T16: ' || sqlerrm; end if;
  end;
  total := total + 1;
  perform public.pla_solicitud_resolver(v_sol2, true, null);
  execute 'reset role';
  if exists (select 1 from public.notificaciones where para_id = e_gerald and mensaje like 'Se actualizó la cuenta bancaria%')
     and (select count(*) from planilla.cuentas_bancarias where empleado_id = e_gerald) = 2
     and (select ultimos4 from planilla.cuentas_bancarias where empleado_id = e_gerald and vigente_hasta is null) = '2222' then
    ok := ok + 1; else fallos := fallos || ' | T16b cambio de cuenta sin aviso o sin historial'; end if;

  -- ── T17: la bitácora es inmutable, incluso para el dueño de la base ──
  total := total + 1;
  begin
    update planilla.bitacora set motivo = 'alterado' where id = (select max(id) from planilla.bitacora);
    fallos := fallos || ' | T17 permitió modificar la bitácora';
  exception when others then
    if sqlerrm like '%solo inserción%' then ok := ok + 1; else fallos := fallos || ' | T17: ' || sqlerrm; end if;
  end;
  total := total + 1;
  begin
    delete from planilla.bitacora where id = (select max(id) from planilla.bitacora);
    fallos := fallos || ' | T17b permitió borrar la bitácora';
  exception when others then
    if sqlerrm like '%solo inserción%' then ok := ok + 1; else fallos := fallos || ' | T17b: ' || sqlerrm; end if;
  end;

  -- ── T18: un cambio por SQL directo también queda registrado y marcado ──
  total := total + 1;
  perform set_config('planilla.origen', '', true);
  perform set_config('planilla.motivo', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  update planilla.fichas set estado = 'suspendida' where empleado_id = e_gerald;
  if exists (select 1 from planilla.bitacora where tabla = 'fichas' and operacion = 'UPDATE' and origen = 'sql_directo'
       and actor_empleado is null and antes ->> 'estado' = 'activa' and despues ->> 'estado' = 'suspendida') then
    ok := ok + 1; else fallos := fallos || ' | T18 cambio directo sin registrar'; end if;

  -- ── T19: permisos — solo el admin otorga; no se revoca al último admin ──
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_jhonny, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.pla_permiso_otorgar(e_gerald, 'admin');
    fallos := fallos || ' | T19 no-admin otorgó permiso';
  exception when others then
    if sqlerrm like 'PLA_PERMISO%' then ok := ok + 1; else fallos := fallos || ' | T19: ' || sqlerrm; end if;
  end;
  total := total + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_tomas, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.pla_permiso_revocar((select (x ->> 'id')::uuid from jsonb_array_elements(public.pla_permisos()) x
      where x ->> 'nivel' = 'admin' limit 1));
    fallos := fallos || ' | T19b revocó al último admin';
  exception when others then
    if sqlerrm like '%último administrador%' then ok := ok + 1; else fallos := fallos || ' | T19b: ' || sqlerrm; end if;
  end;
  execute 'reset role';

  if ok = total then
    raise exception 'ROLLBACK_TESTS_OK %/%', ok, total;
  else
    raise exception 'FALLARON % de % pruebas:%', total - ok, total, fallos;
  end if;
end $$;
