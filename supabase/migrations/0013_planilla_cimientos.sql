-- Planilla · Fase 1 (cimientos) — 13-nov-2026.
-- Principios (ver propuesta de diseño):
--   * Esquema PRIVADO `planilla`: la API no lo expone; el navegador solo llama
--     funciones `public.pla_*` que verifican permiso y segundo factor (aal2).
--     RLS activado sin políticas como segunda barrera.
--   * Nada se sobrescribe: compensación, pagadores, clases, cuenta y
--     deducciones llevan vigencia (vigente_desde / vigente_hasta).
--   * Todo cambio es una solicitud con doble control: quien propone no aprueba
--     y nadie resuelve cambios sobre su propia ficha (impuesto aquí, no en UI).
--   * Bitácora de solo inserción por disparadores: registra también los
--     cambios hechos por SQL directo (origen 'sql_directo').
--   * Número de cuenta cifrado por columna; la llave vive en Supabase Vault.

create schema if not exists planilla;
revoke all on schema planilla from public, anon, authenticated;

select set_config('planilla.origen', 'migracion_0013', true);

-- ───────────────────────── Llave de cifrado ─────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'planilla_llave_cuentas') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'planilla_llave_cuentas',
      'Llave de cifrado de cuentas bancarias del módulo de planilla');
  end if;
end $$;

create or replace function planilla.llave() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'planilla_llave_cuentas';
$$;

create or replace function planilla.cifrar(p_texto text) returns bytea
language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_encrypt(p_texto, planilla.llave());
$$;

create or replace function planilla.descifrar(p_dato bytea) returns text
language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_decrypt(p_dato, planilla.llave());
$$;

-- ───────────────────────────── Catálogos ─────────────────────────────
create table planilla.cat_conceptos (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'deduccion')),
  orden int not null default 100,
  activo boolean not null default true
);

create table planilla.cat_clases (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true
);

create table planilla.cat_bancos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  pais text references public.paises(codigo),
  activo boolean not null default true
);

-- ───────────────────────────── Permisos ─────────────────────────────
-- Independientes de los roles de vacaciones. empresa_id nulo = todas las
-- empresas pagadoras.
create table planilla.permisos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  nivel text not null check (nivel in ('consulta', 'preparacion', 'aprobacion', 'tesoreria', 'admin')),
  empresa_id text references public.empresas(id),
  activo boolean not null default true,
  otorgado_por uuid references public.empleados(id),
  creado_en timestamptz not null default now()
);
create unique index permisos_unico_activo
  on planilla.permisos (empleado_id, nivel, coalesce(empresa_id, '*')) where activo;

-- ───────────────────── Solicitudes de cambio ─────────────────────
create table planilla.solicitudes_cambio (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id),
  tipo text not null check (tipo in ('alta', 'general', 'compensacion', 'pagadores', 'clases', 'cuenta', 'deducciones')),
  payload jsonb not null,
  secreto_cifrado bytea, -- número de cuenta propuesto; jamás va en payload
  vigente_desde date not null,
  motivo text not null check (btrim(motivo) <> ''),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  propuesta_por uuid not null references public.empleados(id),
  propuesta_en timestamptz not null default now(),
  resuelta_por uuid references public.empleados(id),
  resuelta_en timestamptz,
  comentario_resolucion text
);
create unique index solicitudes_una_abierta
  on planilla.solicitudes_cambio (empleado_id, tipo) where estado = 'pendiente';

-- ─────────────────────────── Fichas ───────────────────────────
create table planilla.fichas (
  empleado_id uuid primary key references public.empleados(id),
  legislacion text not null references public.paises(codigo),
  frecuencia_pago text not null check (frecuencia_pago in ('mensual', 'quincenal', 'semanal')),
  moneda text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  fecha_ingreso_original date not null,
  fecha_ultima_liquidacion date,
  estado text not null default 'activa' check (estado in ('activa', 'suspendida', 'baja')),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  check (fecha_ultima_liquidacion is null or fecha_ultima_liquidacion >= fecha_ingreso_original)
);

create table planilla.compensacion (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references planilla.fichas(empleado_id),
  concepto_id text not null references planilla.cat_conceptos(id),
  descripcion text,
  monto numeric(14,2) not null check (monto >= 0),
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  vigente_desde date not null,
  vigente_hasta date,
  solicitud_id uuid references planilla.solicitudes_cambio(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table planilla.pagadores (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references planilla.fichas(empleado_id),
  empresa_id text not null references public.empresas(id),
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  vigente_desde date not null,
  vigente_hasta date,
  solicitud_id uuid references planilla.solicitudes_cambio(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table planilla.clases (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references planilla.fichas(empleado_id),
  clase_id uuid not null references planilla.cat_clases(id),
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  vigente_desde date not null,
  vigente_hasta date,
  solicitud_id uuid references planilla.solicitudes_cambio(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table planilla.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references planilla.fichas(empleado_id),
  banco_id uuid not null references planilla.cat_bancos(id),
  tipo_cuenta text not null check (tipo_cuenta in ('ahorro', 'corriente')),
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  titular text not null,
  identificacion text,
  numero_cifrado bytea not null,
  ultimos4 text not null,
  vigente_desde date not null,
  vigente_hasta date,
  solicitud_id uuid references planilla.solicitudes_cambio(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table planilla.deducciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references planilla.fichas(empleado_id),
  concepto_id text not null references planilla.cat_conceptos(id),
  descripcion text,
  monto_periodo numeric(14,2) not null check (monto_periodo > 0),
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  es_prestamo boolean not null default false,
  monto_original numeric(14,2),
  saldo_inicial numeric(14,2),
  vigente_desde date not null,
  vigente_hasta date,
  solicitud_id uuid references planilla.solicitudes_cambio(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- ─────────────────────────── Bitácora ───────────────────────────
create table planilla.bitacora (
  id bigint generated always as identity primary key,
  ocurrido_en timestamptz not null default clock_timestamp(),
  tabla text not null,
  operacion text not null,
  registro text,
  empleado_afectado uuid,
  actor_empleado uuid,
  actor_auth uuid,
  rol_bd text not null,
  origen text not null,
  motivo text,
  antes jsonb,
  despues jsonb
);
create index bitacora_por_empleado on planilla.bitacora (empleado_afectado, ocurrido_en desc);

create or replace function planilla.tg_bitacora() returns trigger
language plpgsql security definer set search_path = planilla, public as $$
declare
  v_antes jsonb;
  v_despues jsonb;
begin
  -- El texto cifrado nunca entra a la bitácora.
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old) - 'numero_cifrado' - 'secreto_cifrado';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_despues := to_jsonb(new) - 'numero_cifrado' - 'secreto_cifrado';
  end if;
  insert into planilla.bitacora
    (tabla, operacion, registro, empleado_afectado, actor_empleado, actor_auth, rol_bd, origen, motivo, antes, despues)
  values (
    tg_table_name, tg_op,
    coalesce(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'empleado_id', v_antes ->> 'empleado_id'),
    nullif(coalesce(v_despues ->> 'empleado_id', v_antes ->> 'empleado_id'), '')::uuid,
    public.mi_empleado_id(), auth.uid(), session_user,
    coalesce(nullif(current_setting('planilla.origen', true), ''), 'sql_directo'),
    nullif(current_setting('planilla.motivo', true), ''),
    v_antes, v_despues);
  return coalesce(new, old);
end $$;

create or replace function planilla.tg_bitacora_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La bitácora de planilla es de solo inserción: no se modifica ni se borra';
end $$;

create trigger bitacora_sin_cambios before update or delete on planilla.bitacora
  for each row execute function planilla.tg_bitacora_inmutable();
create trigger bitacora_sin_truncar before truncate on planilla.bitacora
  for each statement execute function planilla.tg_bitacora_inmutable();

do $$
declare t text;
begin
  foreach t in array array['cat_conceptos', 'cat_clases', 'cat_bancos', 'permisos', 'solicitudes_cambio',
    'fichas', 'compensacion', 'pagadores', 'clases', 'cuentas_bancarias', 'deducciones'] loop
    execute format('create trigger bitacora_%1$s after insert or update or delete on planilla.%1$I
      for each row execute function planilla.tg_bitacora()', t);
  end loop;
  -- RLS sin políticas en todo el esquema: segunda barrera.
  foreach t in array array['cat_conceptos', 'cat_clases', 'cat_bancos', 'permisos', 'solicitudes_cambio',
    'fichas', 'compensacion', 'pagadores', 'clases', 'cuentas_bancarias', 'deducciones', 'bitacora'] loop
    execute format('alter table planilla.%I enable row level security', t);
  end loop;
end $$;

-- ─────────────────────── Funciones de apoyo ───────────────────────
create or replace function planilla.capacidad(p_cap text) returns boolean
language sql stable security definer set search_path = planilla, public as $$
  select exists (
    select 1 from planilla.permisos pe join public.empleados e on e.id = pe.empleado_id
    where pe.empleado_id = public.mi_empleado_id() and pe.activo and e.activo
      and (p_cap = 'ver' or pe.nivel = p_cap)
  );
$$;

-- Verifica sesión, segundo factor y permiso. Devuelve el empleado actor.
create or replace function planilla.exigir(p_cap text) returns uuid
language plpgsql stable security definer set search_path = planilla, public as $$
declare v_yo uuid := public.mi_empleado_id();
begin
  if v_yo is null then
    raise exception 'PLA_SESION: inicia sesión para usar Planilla';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'PLA_MFA: Planilla exige verificación en dos pasos';
  end if;
  if not planilla.capacidad(p_cap) then
    raise exception 'PLA_PERMISO: no tienes permiso de planilla para esta acción';
  end if;
  return v_yo;
end $$;

create or replace function planilla.veo_todo() returns boolean
language sql stable security definer set search_path = planilla, public as $$
  select exists (select 1 from planilla.permisos
    where empleado_id = public.mi_empleado_id() and activo and empresa_id is null);
$$;

-- Con permiso limitado a una empresa se ven las fichas que esa empresa paga.
create or replace function planilla.veo_empleado(p_emp uuid) returns boolean
language sql stable security definer set search_path = planilla, public as $$
  select planilla.veo_todo() or exists (
    select 1 from planilla.pagadores g join planilla.permisos pe on pe.empresa_id = g.empresa_id
    where g.empleado_id = p_emp and g.vigente_hasta is null
      and pe.empleado_id = public.mi_empleado_id() and pe.activo);
$$;

create or replace function planilla.notificar(p_para uuid, p_mensaje text) returns void
language sql security definer set search_path = planilla, public as $$
  insert into public.notificaciones (para_id, mensaje) values (p_para, p_mensaje);
$$;

-- Estado de una sección de la ficha a una fecha (lo que estaba vigente).
create or replace function planilla.seccion(p_emp uuid, p_seccion text, p_fecha date) returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
declare v jsonb;
begin
  if p_seccion = 'general' then
    select jsonb_build_object('legislacion', legislacion, 'frecuencia_pago', frecuencia_pago, 'moneda', moneda,
      'fecha_ingreso_original', fecha_ingreso_original, 'fecha_ultima_liquidacion', fecha_ultima_liquidacion,
      'estado', estado) into v from planilla.fichas where empleado_id = p_emp;
  elsif p_seccion = 'compensacion' then
    select coalesce(jsonb_agg(jsonb_build_object('concepto_id', c.concepto_id, 'concepto', k.nombre,
      'descripcion', c.descripcion, 'monto', c.monto, 'moneda', c.moneda, 'vigente_desde', c.vigente_desde)
      order by k.orden, c.descripcion), '[]'::jsonb) into v
    from planilla.compensacion c join planilla.cat_conceptos k on k.id = c.concepto_id
    where c.empleado_id = p_emp and c.vigente_desde <= p_fecha and (c.vigente_hasta is null or c.vigente_hasta >= p_fecha);
  elsif p_seccion = 'pagadores' then
    select coalesce(jsonb_agg(jsonb_build_object('empresa_id', g.empresa_id, 'empresa', em.nombre,
      'porcentaje', g.porcentaje, 'vigente_desde', g.vigente_desde) order by g.porcentaje desc, em.nombre), '[]'::jsonb) into v
    from planilla.pagadores g join public.empresas em on em.id = g.empresa_id
    where g.empleado_id = p_emp and g.vigente_desde <= p_fecha and (g.vigente_hasta is null or g.vigente_hasta >= p_fecha);
  elsif p_seccion = 'clases' then
    select coalesce(jsonb_agg(jsonb_build_object('clase_id', c.clase_id, 'clase', k.nombre,
      'porcentaje', c.porcentaje, 'vigente_desde', c.vigente_desde) order by c.porcentaje desc, k.nombre), '[]'::jsonb) into v
    from planilla.clases c join planilla.cat_clases k on k.id = c.clase_id
    where c.empleado_id = p_emp and c.vigente_desde <= p_fecha and (c.vigente_hasta is null or c.vigente_hasta >= p_fecha);
  elsif p_seccion = 'cuenta' then
    select jsonb_build_object('banco_id', c.banco_id, 'banco', b.nombre, 'tipo_cuenta', c.tipo_cuenta,
      'moneda', c.moneda, 'titular', c.titular, 'identificacion', c.identificacion, 'ultimos4', c.ultimos4,
      'vigente_desde', c.vigente_desde) into v
    from planilla.cuentas_bancarias c join planilla.cat_bancos b on b.id = c.banco_id
    where c.empleado_id = p_emp and c.vigente_desde <= p_fecha and (c.vigente_hasta is null or c.vigente_hasta >= p_fecha)
    order by c.vigente_desde desc limit 1;
  elsif p_seccion = 'deducciones' then
    select coalesce(jsonb_agg(jsonb_build_object('concepto_id', d.concepto_id, 'concepto', k.nombre,
      'descripcion', d.descripcion, 'monto_periodo', d.monto_periodo, 'moneda', d.moneda,
      'es_prestamo', d.es_prestamo, 'monto_original', d.monto_original, 'saldo_inicial', d.saldo_inicial,
      'vigente_desde', d.vigente_desde) order by k.orden, d.descripcion), '[]'::jsonb) into v
    from planilla.deducciones d join planilla.cat_conceptos k on k.id = d.concepto_id
    where d.empleado_id = p_emp and d.vigente_desde <= p_fecha and (d.vigente_hasta is null or d.vigente_hasta >= p_fecha);
  end if;
  return v;
end $$;

-- ─────────────────── Validación de cada sección ───────────────────
create or replace function planilla.validar_seccion(p_emp uuid, p_seccion text, p_datos jsonb, p_desde date)
returns void language plpgsql stable security definer set search_path = planilla, public as $$
declare
  v_ultima date;
  v_suma numeric;
  i jsonb;
begin
  if p_desde is null then raise exception 'Indica la fecha de vigencia del cambio'; end if;

  -- La vigencia nueva debe ser posterior a la última versión: no se insertan
  -- versiones en medio del historial.
  if p_seccion = 'compensacion' then select max(vigente_desde) into v_ultima from planilla.compensacion where empleado_id = p_emp;
  elsif p_seccion = 'pagadores' then select max(vigente_desde) into v_ultima from planilla.pagadores where empleado_id = p_emp;
  elsif p_seccion = 'clases' then select max(vigente_desde) into v_ultima from planilla.clases where empleado_id = p_emp;
  elsif p_seccion = 'cuenta' then select max(vigente_desde) into v_ultima from planilla.cuentas_bancarias where empleado_id = p_emp;
  elsif p_seccion = 'deducciones' then select max(vigente_desde) into v_ultima from planilla.deducciones where empleado_id = p_emp;
  end if;
  if v_ultima is not null and p_desde <= v_ultima then
    raise exception 'La vigencia debe ser posterior a la última versión registrada (%)', v_ultima;
  end if;

  if p_seccion = 'general' then
    if not exists (select 1 from public.paises where codigo = p_datos ->> 'legislacion') then
      raise exception 'Elige la legislación laboral aplicable';
    end if;
    if coalesce(p_datos ->> 'frecuencia_pago', '') not in ('mensual', 'quincenal', 'semanal') then
      raise exception 'Elige la frecuencia de pago';
    end if;
    if coalesce(p_datos ->> 'moneda', '') !~ '^[A-Z]{3}$' then raise exception 'Indica la moneda (por ejemplo USD)'; end if;
    if (p_datos ->> 'fecha_ingreso_original') is null then raise exception 'Indica la fecha de ingreso original'; end if;
    if (p_datos ->> 'fecha_ultima_liquidacion') is not null
       and (p_datos ->> 'fecha_ultima_liquidacion')::date < (p_datos ->> 'fecha_ingreso_original')::date then
      raise exception 'La última liquidación no puede ser anterior al ingreso';
    end if;
    if (p_datos ? 'estado') and (p_datos ->> 'estado') not in ('activa', 'suspendida', 'baja') then
      raise exception 'Estado de ficha no válido';
    end if;

  elsif p_seccion = 'compensacion' then
    if jsonb_typeof(p_datos) <> 'array' or jsonb_array_length(p_datos) = 0 then
      raise exception 'La compensación debe incluir al menos el salario base';
    end if;
    for i in select * from jsonb_array_elements(p_datos) loop
      if not exists (select 1 from planilla.cat_conceptos where id = i ->> 'concepto_id' and tipo = 'ingreso' and activo) then
        raise exception 'Concepto de pago no válido: %', i ->> 'concepto_id';
      end if;
      if (i ->> 'monto') is null or (i ->> 'monto')::numeric < 0 then raise exception 'Los montos no pueden ser negativos'; end if;
      if coalesce(i ->> 'moneda', '') !~ '^[A-Z]{3}$' then raise exception 'Indica la moneda de cada concepto'; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(p_datos) x where x ->> 'concepto_id' = 'salario_base') <> 1 then
      raise exception 'Debe haber exactamente un salario base';
    end if;
    if (select (x ->> 'monto')::numeric from jsonb_array_elements(p_datos) x where x ->> 'concepto_id' = 'salario_base') <= 0 then
      raise exception 'El salario base debe ser mayor que cero';
    end if;

  elsif p_seccion = 'pagadores' then
    if jsonb_typeof(p_datos) <> 'array' or jsonb_array_length(p_datos) = 0 then
      raise exception 'Indica al menos una empresa pagadora';
    end if;
    for i in select * from jsonb_array_elements(p_datos) loop
      if not exists (select 1 from public.empresas where id = i ->> 'empresa_id') then
        raise exception 'Empresa pagadora no válida';
      end if;
      if (i ->> 'porcentaje') is null or (i ->> 'porcentaje')::numeric <= 0 then
        raise exception 'Cada empresa pagadora necesita un porcentaje mayor que cero';
      end if;
    end loop;
    if (select count(distinct x ->> 'empresa_id') from jsonb_array_elements(p_datos) x) <> jsonb_array_length(p_datos) then
      raise exception 'Una empresa pagadora está repetida';
    end if;
    select sum((x ->> 'porcentaje')::numeric) into v_suma from jsonb_array_elements(p_datos) x;
    if v_suma <> 100 then raise exception 'Los porcentajes de las empresas pagadoras deben sumar 100 %% (suman %)', v_suma; end if;

  elsif p_seccion = 'clases' then
    if jsonb_typeof(p_datos) <> 'array' or jsonb_array_length(p_datos) = 0 then
      raise exception 'Todo empleado debe tener al menos una clase asignada';
    end if;
    for i in select * from jsonb_array_elements(p_datos) loop
      if not exists (select 1 from planilla.cat_clases where id = (i ->> 'clase_id')::uuid and activa) then
        raise exception 'Clase no válida o inactiva';
      end if;
      if (i ->> 'porcentaje') is null or (i ->> 'porcentaje')::numeric <= 0 then
        raise exception 'Cada clase necesita un porcentaje mayor que cero';
      end if;
    end loop;
    if (select count(distinct x ->> 'clase_id') from jsonb_array_elements(p_datos) x) <> jsonb_array_length(p_datos) then
      raise exception 'Una clase está repetida';
    end if;
    select sum((x ->> 'porcentaje')::numeric) into v_suma from jsonb_array_elements(p_datos) x;
    if v_suma <> 100 then raise exception 'Los porcentajes de las clases deben sumar 100 %% (suman %)', v_suma; end if;

  elsif p_seccion = 'cuenta' then
    if not exists (select 1 from planilla.cat_bancos where id = (p_datos ->> 'banco_id')::uuid and activo) then
      raise exception 'Elige el banco de la cuenta';
    end if;
    if coalesce(p_datos ->> 'tipo_cuenta', '') not in ('ahorro', 'corriente') then raise exception 'Elige el tipo de cuenta'; end if;
    if coalesce(p_datos ->> 'moneda', '') !~ '^[A-Z]{3}$' then raise exception 'Indica la moneda de la cuenta'; end if;
    if coalesce(btrim(p_datos ->> 'titular'), '') = '' then raise exception 'Indica el titular de la cuenta'; end if;
    if coalesce(p_datos ->> 'ultimos4', '') = '' then raise exception 'Falta el número de cuenta'; end if;

  elsif p_seccion = 'deducciones' then
    if jsonb_typeof(p_datos) <> 'array' then raise exception 'Formato de deducciones no válido'; end if;
    for i in select * from jsonb_array_elements(p_datos) loop
      if not exists (select 1 from planilla.cat_conceptos where id = i ->> 'concepto_id' and tipo = 'deduccion' and activo) then
        raise exception 'Tipo de deducción no válido';
      end if;
      if (i ->> 'monto_periodo') is null or (i ->> 'monto_periodo')::numeric <= 0 then
        raise exception 'Cada deducción necesita un monto por período mayor que cero';
      end if;
      if coalesce(i ->> 'moneda', '') !~ '^[A-Z]{3}$' then raise exception 'Indica la moneda de cada deducción'; end if;
      if coalesce((i ->> 'es_prestamo')::boolean, false) then
        if (i ->> 'monto_original') is null or (i ->> 'monto_original')::numeric <= 0 then
          raise exception 'Un préstamo necesita su monto original';
        end if;
        if (i ->> 'saldo_inicial') is null or (i ->> 'saldo_inicial')::numeric < 0
           or (i ->> 'saldo_inicial')::numeric > (i ->> 'monto_original')::numeric then
          raise exception 'El saldo del préstamo debe estar entre cero y el monto original';
        end if;
      end if;
    end loop;
  else
    raise exception 'Sección desconocida: %', p_seccion;
  end if;
end $$;

create or replace function planilla.validar(p_emp uuid, p_tipo text, p_payload jsonb, p_desde date)
returns void language plpgsql stable security definer set search_path = planilla, public as $$
begin
  if p_tipo = 'alta' then
    if not (p_payload ? 'general' and p_payload ? 'compensacion' and p_payload ? 'pagadores' and p_payload ? 'clases') then
      raise exception 'El alta necesita datos generales, compensación, empresas pagadoras y clases';
    end if;
    perform planilla.validar_seccion(p_emp, 'general', p_payload -> 'general', p_desde);
    perform planilla.validar_seccion(p_emp, 'compensacion', p_payload -> 'compensacion', p_desde);
    perform planilla.validar_seccion(p_emp, 'pagadores', p_payload -> 'pagadores', p_desde);
    perform planilla.validar_seccion(p_emp, 'clases', p_payload -> 'clases', p_desde);
    if p_payload ? 'cuenta' then perform planilla.validar_seccion(p_emp, 'cuenta', p_payload -> 'cuenta', p_desde); end if;
    if p_payload ? 'deducciones' then perform planilla.validar_seccion(p_emp, 'deducciones', p_payload -> 'deducciones', p_desde); end if;
  else
    perform planilla.validar_seccion(p_emp, p_tipo, p_payload, p_desde);
  end if;
end $$;

-- ─────────────────── Aplicación de un cambio aprobado ───────────────────
create or replace function planilla.aplicar_seccion(p_emp uuid, p_seccion text, p_datos jsonb, p_desde date, p_sol uuid, p_secreto bytea)
returns void language plpgsql security definer set search_path = planilla, public as $$
begin
  if p_seccion = 'general' then
    update planilla.fichas set
      legislacion = p_datos ->> 'legislacion',
      frecuencia_pago = p_datos ->> 'frecuencia_pago',
      moneda = p_datos ->> 'moneda',
      fecha_ingreso_original = (p_datos ->> 'fecha_ingreso_original')::date,
      fecha_ultima_liquidacion = (p_datos ->> 'fecha_ultima_liquidacion')::date,
      estado = coalesce(p_datos ->> 'estado', estado),
      actualizada_en = now()
    where empleado_id = p_emp;

  elsif p_seccion = 'compensacion' then
    update planilla.compensacion set vigente_hasta = p_desde - 1 where empleado_id = p_emp and vigente_hasta is null;
    insert into planilla.compensacion (empleado_id, concepto_id, descripcion, monto, moneda, vigente_desde, solicitud_id)
    select p_emp, x ->> 'concepto_id', nullif(btrim(x ->> 'descripcion'), ''), (x ->> 'monto')::numeric, x ->> 'moneda', p_desde, p_sol
    from jsonb_array_elements(p_datos) x;

  elsif p_seccion = 'pagadores' then
    update planilla.pagadores set vigente_hasta = p_desde - 1 where empleado_id = p_emp and vigente_hasta is null;
    insert into planilla.pagadores (empleado_id, empresa_id, porcentaje, vigente_desde, solicitud_id)
    select p_emp, x ->> 'empresa_id', (x ->> 'porcentaje')::numeric, p_desde, p_sol from jsonb_array_elements(p_datos) x;

  elsif p_seccion = 'clases' then
    update planilla.clases set vigente_hasta = p_desde - 1 where empleado_id = p_emp and vigente_hasta is null;
    insert into planilla.clases (empleado_id, clase_id, porcentaje, vigente_desde, solicitud_id)
    select p_emp, (x ->> 'clase_id')::uuid, (x ->> 'porcentaje')::numeric, p_desde, p_sol from jsonb_array_elements(p_datos) x;

  elsif p_seccion = 'cuenta' then
    if p_secreto is null then raise exception 'La solicitud no trae el número de cuenta'; end if;
    update planilla.cuentas_bancarias set vigente_hasta = p_desde - 1 where empleado_id = p_emp and vigente_hasta is null;
    insert into planilla.cuentas_bancarias (empleado_id, banco_id, tipo_cuenta, moneda, titular, identificacion,
      numero_cifrado, ultimos4, vigente_desde, solicitud_id)
    values (p_emp, (p_datos ->> 'banco_id')::uuid, p_datos ->> 'tipo_cuenta', p_datos ->> 'moneda',
      btrim(p_datos ->> 'titular'), nullif(btrim(p_datos ->> 'identificacion'), ''),
      p_secreto, p_datos ->> 'ultimos4', p_desde, p_sol);

  elsif p_seccion = 'deducciones' then
    update planilla.deducciones set vigente_hasta = p_desde - 1 where empleado_id = p_emp and vigente_hasta is null;
    insert into planilla.deducciones (empleado_id, concepto_id, descripcion, monto_periodo, moneda, es_prestamo,
      monto_original, saldo_inicial, vigente_desde, solicitud_id)
    select p_emp, x ->> 'concepto_id', nullif(btrim(x ->> 'descripcion'), ''), (x ->> 'monto_periodo')::numeric,
      x ->> 'moneda', coalesce((x ->> 'es_prestamo')::boolean, false),
      (x ->> 'monto_original')::numeric, (x ->> 'saldo_inicial')::numeric, p_desde, p_sol
    from jsonb_array_elements(p_datos) x;
  end if;
end $$;

create or replace function planilla.aplicar(p_sol planilla.solicitudes_cambio)
returns void language plpgsql security definer set search_path = planilla, public as $$
declare v_g jsonb;
begin
  if p_sol.tipo = 'alta' then
    v_g := p_sol.payload -> 'general';
    insert into planilla.fichas (empleado_id, legislacion, frecuencia_pago, moneda, fecha_ingreso_original, fecha_ultima_liquidacion)
    values (p_sol.empleado_id, v_g ->> 'legislacion', v_g ->> 'frecuencia_pago', v_g ->> 'moneda',
      (v_g ->> 'fecha_ingreso_original')::date, (v_g ->> 'fecha_ultima_liquidacion')::date);
    perform planilla.aplicar_seccion(p_sol.empleado_id, 'compensacion', p_sol.payload -> 'compensacion', p_sol.vigente_desde, p_sol.id, null);
    perform planilla.aplicar_seccion(p_sol.empleado_id, 'pagadores', p_sol.payload -> 'pagadores', p_sol.vigente_desde, p_sol.id, null);
    perform planilla.aplicar_seccion(p_sol.empleado_id, 'clases', p_sol.payload -> 'clases', p_sol.vigente_desde, p_sol.id, null);
    if p_sol.payload ? 'cuenta' then
      perform planilla.aplicar_seccion(p_sol.empleado_id, 'cuenta', p_sol.payload -> 'cuenta', p_sol.vigente_desde, p_sol.id, p_sol.secreto_cifrado);
    end if;
    if p_sol.payload ? 'deducciones' then
      perform planilla.aplicar_seccion(p_sol.empleado_id, 'deducciones', p_sol.payload -> 'deducciones', p_sol.vigente_desde, p_sol.id, null);
    end if;
  else
    perform planilla.aplicar_seccion(p_sol.empleado_id, p_sol.tipo, p_sol.payload, p_sol.vigente_desde, p_sol.id, p_sol.secreto_cifrado);
  end if;
end $$;

-- ═══════════════ Funciones públicas (lo único que ve la API) ═══════════════

-- Se puede llamar sin segundo factor: solo dice si la persona tiene acceso.
create or replace function public.pla_mi_acceso() returns jsonb
language sql stable security definer set search_path = planilla, public as $$
  select jsonb_build_object(
    'empleado_id', public.mi_empleado_id(),
    'tiene_acceso', planilla.capacidad('ver'),
    'aal2', coalesce(auth.jwt() ->> 'aal', '') = 'aal2',
    'niveles', coalesce((select jsonb_agg(distinct pe.nivel) from planilla.permisos pe
      where pe.empleado_id = public.mi_empleado_id() and pe.activo), '[]'::jsonb));
$$;

create or replace function public.pla_catalogos() returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
begin
  perform planilla.exigir('ver');
  return jsonb_build_object(
    'empresas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre), '[]'::jsonb) from public.empresas),
    'legislaciones', (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre) order by nombre), '[]'::jsonb) from public.paises),
    'clases', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'activa', activa) order by nombre), '[]'::jsonb) from planilla.cat_clases),
    'bancos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'pais', pais, 'activo', activo) order by nombre), '[]'::jsonb) from planilla.cat_bancos),
    'conceptos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'tipo', tipo) order by tipo, orden), '[]'::jsonb) from planilla.cat_conceptos where activo),
    'empleados_sin_ficha', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre,
        'fecha_ingreso', e.fecha_ingreso, 'pais', e.pais, 'empresa_id', e.empresa_id) order by e.nombre), '[]'::jsonb)
      from public.empleados e
      where e.activo and not exists (select 1 from planilla.fichas f where f.empleado_id = e.id)
        and not exists (select 1 from planilla.solicitudes_cambio s where s.empleado_id = e.id and s.tipo = 'alta' and s.estado = 'pendiente')));
end $$;

create or replace function public.pla_fichas() returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
declare v jsonb;
begin
  perform planilla.exigir('ver');
  select coalesce(jsonb_agg(t.x order by t.x ->> 'nombre'), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'empleado_id', f.empleado_id, 'nombre', e.nombre, 'puesto', e.puesto, 'empresa_asignada', em.nombre,
      'legislacion', f.legislacion, 'frecuencia_pago', f.frecuencia_pago, 'moneda', f.moneda,
      'fecha_ingreso_original', f.fecha_ingreso_original, 'fecha_ultima_liquidacion', f.fecha_ultima_liquidacion,
      'estado', f.estado,
      'compensacion', planilla.seccion(f.empleado_id, 'compensacion', current_date),
      'pagadores', planilla.seccion(f.empleado_id, 'pagadores', current_date),
      'clases', planilla.seccion(f.empleado_id, 'clases', current_date),
      'cuenta', planilla.seccion(f.empleado_id, 'cuenta', current_date),
      'deducciones', planilla.seccion(f.empleado_id, 'deducciones', current_date),
      'pendientes', (select count(*) from planilla.solicitudes_cambio s where s.empleado_id = f.empleado_id and s.estado = 'pendiente')
    ) as x
    from planilla.fichas f
    join public.empleados e on e.id = f.empleado_id
    left join public.empresas em on em.id = e.empresa_id
    where planilla.veo_empleado(f.empleado_id)
  ) t;
  return v;
end $$;

-- Historial completo de una ficha (todas las versiones de cada sección).
create or replace function public.pla_ficha_historial(p_empleado uuid) returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
begin
  perform planilla.exigir('ver');
  if not planilla.veo_empleado(p_empleado) then
    raise exception 'PLA_PERMISO: no tienes permiso para ver esta ficha';
  end if;
  return jsonb_build_object(
    'compensacion', (select coalesce(jsonb_agg(jsonb_build_object('concepto', k.nombre, 'descripcion', c.descripcion,
        'monto', c.monto, 'moneda', c.moneda, 'vigente_desde', c.vigente_desde, 'vigente_hasta', c.vigente_hasta)
        order by c.vigente_desde desc, k.orden), '[]'::jsonb)
      from planilla.compensacion c join planilla.cat_conceptos k on k.id = c.concepto_id where c.empleado_id = p_empleado),
    'pagadores', (select coalesce(jsonb_agg(jsonb_build_object('empresa', em.nombre, 'porcentaje', g.porcentaje,
        'vigente_desde', g.vigente_desde, 'vigente_hasta', g.vigente_hasta) order by g.vigente_desde desc, g.porcentaje desc), '[]'::jsonb)
      from planilla.pagadores g join public.empresas em on em.id = g.empresa_id where g.empleado_id = p_empleado),
    'clases', (select coalesce(jsonb_agg(jsonb_build_object('clase', k.nombre, 'porcentaje', c.porcentaje,
        'vigente_desde', c.vigente_desde, 'vigente_hasta', c.vigente_hasta) order by c.vigente_desde desc, c.porcentaje desc), '[]'::jsonb)
      from planilla.clases c join planilla.cat_clases k on k.id = c.clase_id where c.empleado_id = p_empleado),
    'cuenta', (select coalesce(jsonb_agg(jsonb_build_object('banco', b.nombre, 'tipo_cuenta', c.tipo_cuenta, 'moneda', c.moneda,
        'titular', c.titular, 'ultimos4', c.ultimos4, 'vigente_desde', c.vigente_desde, 'vigente_hasta', c.vigente_hasta)
        order by c.vigente_desde desc), '[]'::jsonb)
      from planilla.cuentas_bancarias c join planilla.cat_bancos b on b.id = c.banco_id where c.empleado_id = p_empleado),
    'deducciones', (select coalesce(jsonb_agg(jsonb_build_object('concepto', k.nombre, 'descripcion', d.descripcion,
        'monto_periodo', d.monto_periodo, 'moneda', d.moneda, 'es_prestamo', d.es_prestamo, 'monto_original', d.monto_original,
        'saldo_inicial', d.saldo_inicial, 'vigente_desde', d.vigente_desde, 'vigente_hasta', d.vigente_hasta)
        order by d.vigente_desde desc, k.orden), '[]'::jsonb)
      from planilla.deducciones d join planilla.cat_conceptos k on k.id = d.concepto_id where d.empleado_id = p_empleado));
end $$;

create or replace function public.pla_solicitudes(p_estado text default 'pendiente') returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
declare v jsonb; v_yo uuid;
begin
  v_yo := planilla.exigir('ver');
  select coalesce(jsonb_agg(t.x order by t.x ->> 'propuesta_en' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', s.id, 'tipo', s.tipo, 'estado', s.estado, 'empleado_id', s.empleado_id, 'empleado', e.nombre,
      'payload', s.payload, 'trae_cuenta', s.secreto_cifrado is not null,
      'vigente_desde', s.vigente_desde, 'motivo', s.motivo,
      'propuesta_por_id', s.propuesta_por, 'propuesta_por', pr.nombre, 'propuesta_en', s.propuesta_en,
      'resuelta_por', rs.nombre, 'resuelta_en', s.resuelta_en, 'comentario_resolucion', s.comentario_resolucion,
      'actual', case when s.tipo = 'alta' or s.estado <> 'pendiente' then null
                     else planilla.seccion(s.empleado_id, s.tipo, current_date) end
    ) as x
    from planilla.solicitudes_cambio s
    join public.empleados e on e.id = s.empleado_id
    join public.empleados pr on pr.id = s.propuesta_por
    left join public.empleados rs on rs.id = s.resuelta_por
    where (p_estado = 'todas' or s.estado = p_estado)
      and (planilla.veo_todo() or planilla.veo_empleado(s.empleado_id) or s.propuesta_por = v_yo)
    order by s.propuesta_en desc limit 300
  ) t;
  return v;
end $$;

create or replace function public.pla_solicitud_crear(
  p_empleado uuid, p_tipo text, p_payload jsonb, p_vigente_desde date, p_motivo text, p_numero_cuenta text default null)
returns uuid language plpgsql security definer set search_path = planilla, public as $$
declare
  v_yo uuid;
  v_id uuid;
  v_num text;
  v_payload jsonb := p_payload;
  v_secreto bytea;
  v_con_cuenta boolean;
begin
  v_yo := planilla.exigir('preparacion');
  perform set_config('planilla.origen', 'pla_solicitud_crear', true);
  perform set_config('planilla.motivo', left(coalesce(p_motivo, ''), 500), true);

  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escribe el motivo del cambio'; end if;
  if p_tipo not in ('alta', 'general', 'compensacion', 'pagadores', 'clases', 'cuenta', 'deducciones') then
    raise exception 'Tipo de solicitud no válido';
  end if;
  if not exists (select 1 from public.empleados where id = p_empleado) then raise exception 'Empleado no encontrado'; end if;

  if p_tipo = 'alta' then
    if exists (select 1 from planilla.fichas where empleado_id = p_empleado) then
      raise exception 'Este empleado ya tiene ficha de planilla';
    end if;
  else
    if not exists (select 1 from planilla.fichas where empleado_id = p_empleado) then
      raise exception 'El empleado aún no tiene ficha de planilla: crea primero el alta';
    end if;
    if not planilla.veo_empleado(p_empleado) then
      raise exception 'PLA_PERMISO: no tienes permiso sobre esta ficha';
    end if;
  end if;
  if exists (select 1 from planilla.solicitudes_cambio where empleado_id = p_empleado and tipo = p_tipo and estado = 'pendiente') then
    raise exception 'Ya hay una solicitud pendiente de este tipo para el empleado: resuélvela o cancélala primero';
  end if;

  -- El número de cuenta se cifra de inmediato y nunca queda en el payload.
  v_con_cuenta := p_tipo = 'cuenta' or (p_tipo = 'alta' and p_payload ? 'cuenta');
  if v_con_cuenta then
    v_num := regexp_replace(coalesce(p_numero_cuenta, ''), '[\s-]', '', 'g');
    if v_num !~ '^[A-Za-z0-9]{4,34}$' then
      raise exception 'Escribe el número de cuenta completo (solo letras y números)';
    end if;
    v_secreto := planilla.cifrar(v_num);
    if p_tipo = 'cuenta' then
      v_payload := v_payload || jsonb_build_object('ultimos4', right(v_num, 4));
    else
      v_payload := jsonb_set(v_payload, '{cuenta,ultimos4}', to_jsonb(right(v_num, 4)));
    end if;
  end if;

  perform planilla.validar(p_empleado, p_tipo, v_payload, p_vigente_desde);

  insert into planilla.solicitudes_cambio (empleado_id, tipo, payload, secreto_cifrado, vigente_desde, motivo, propuesta_por)
  values (p_empleado, p_tipo, v_payload, v_secreto, p_vigente_desde, btrim(p_motivo), v_yo)
  returning id into v_id;

  -- Aviso sin datos sensibles: el detalle se ve solo dentro de Planilla.
  perform planilla.notificar(a.empleado_id, 'Planilla: hay una solicitud de cambio pendiente de tu aprobación.')
  from (select distinct pe.empleado_id from planilla.permisos pe
        where pe.nivel = 'aprobacion' and pe.activo and pe.empleado_id <> v_yo) a;
  return v_id;
end $$;

create or replace function public.pla_solicitud_resolver(p_id uuid, p_aprobar boolean, p_comentario text default null)
returns void language plpgsql security definer set search_path = planilla, public as $$
declare
  v_yo uuid;
  v_sol planilla.solicitudes_cambio;
begin
  v_yo := planilla.exigir('aprobacion');
  perform set_config('planilla.origen', 'pla_solicitud_resolver', true);

  select * into v_sol from planilla.solicitudes_cambio where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_sol.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta'; end if;
  perform set_config('planilla.motivo', left(v_sol.motivo, 500), true);

  -- Doble control, impuesto en la base:
  if v_sol.propuesta_por = v_yo then
    raise exception 'Doble control: no puedes resolver una solicitud que tú propusiste';
  end if;
  if v_sol.empleado_id = v_yo then
    raise exception 'Doble control: no puedes resolver cambios sobre tu propia ficha; debe hacerlo otro aprobador';
  end if;
  if not p_aprobar and coalesce(btrim(p_comentario), '') = '' then
    raise exception 'Explica el motivo del rechazo';
  end if;

  if p_aprobar then
    perform planilla.validar(v_sol.empleado_id, v_sol.tipo, v_sol.payload, v_sol.vigente_desde);
    perform planilla.aplicar(v_sol);
  end if;

  update planilla.solicitudes_cambio set
    estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
    resuelta_por = v_yo, resuelta_en = now(),
    comentario_resolucion = nullif(btrim(p_comentario), ''),
    secreto_cifrado = null -- ya vive en la cuenta (o se descarta al rechazar)
  where id = p_id;

  perform planilla.notificar(v_sol.propuesta_por,
    'Planilla: tu solicitud de cambio fue ' || case when p_aprobar then 'aprobada.' else 'rechazada.' end);
  -- Control antifraude: el titular se entera cuando cambia su cuenta de pago.
  if p_aprobar and v_sol.tipo = 'cuenta' then
    perform planilla.notificar(v_sol.empleado_id,
      'Se actualizó la cuenta bancaria registrada para tus pagos. Si no reconoces este cambio, avisa de inmediato a Finanzas.');
  end if;
end $$;

create or replace function public.pla_solicitud_cancelar(p_id uuid)
returns void language plpgsql security definer set search_path = planilla, public as $$
declare v_yo uuid; v_sol planilla.solicitudes_cambio;
begin
  v_yo := planilla.exigir('preparacion');
  perform set_config('planilla.origen', 'pla_solicitud_cancelar', true);
  select * into v_sol from planilla.solicitudes_cambio where id = p_id for update;
  if not found or v_sol.estado <> 'pendiente' then raise exception 'La solicitud ya no está pendiente'; end if;
  if v_sol.propuesta_por <> v_yo then raise exception 'Solo quien propuso la solicitud puede cancelarla'; end if;
  update planilla.solicitudes_cambio set estado = 'cancelada', resuelta_por = v_yo, resuelta_en = now(), secreto_cifrado = null
  where id = p_id;
end $$;

-- Ver un número de cuenta completo: solo aprobación o tesorería, con motivo,
-- y cada lectura queda en la bitácora.
create or replace function public.pla_revelar_cuenta(p_empleado uuid, p_solicitud uuid, p_motivo text)
returns text language plpgsql security definer set search_path = planilla, public as $$
declare v_yo uuid; v_dato bytea; v_emp uuid;
begin
  v_yo := planilla.exigir('ver');
  if not (planilla.capacidad('aprobacion') or planilla.capacidad('tesoreria')) then
    raise exception 'PLA_PERMISO: solo aprobación o tesorería pueden ver el número completo';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Indica para qué necesitas ver el número completo'; end if;

  if p_solicitud is not null then
    select secreto_cifrado, empleado_id into v_dato, v_emp from planilla.solicitudes_cambio
    where id = p_solicitud and estado = 'pendiente';
  else
    select numero_cifrado, empleado_id into v_dato, v_emp from planilla.cuentas_bancarias
    where empleado_id = p_empleado and vigente_hasta is null order by vigente_desde desc limit 1;
  end if;
  if v_dato is null then raise exception 'No hay número de cuenta que mostrar'; end if;
  if not planilla.veo_empleado(v_emp) and not planilla.veo_todo() then
    raise exception 'PLA_PERMISO: no tienes permiso sobre esta ficha';
  end if;

  insert into planilla.bitacora (tabla, operacion, registro, empleado_afectado, actor_empleado, actor_auth, rol_bd, origen, motivo)
  values ('cuentas_bancarias', 'REVELAR', coalesce(p_solicitud::text, v_emp::text), v_emp, v_yo, auth.uid(), session_user,
    'pla_revelar_cuenta', left(btrim(p_motivo), 500));
  return planilla.descifrar(v_dato);
end $$;

create or replace function public.pla_bitacora(p_empleado uuid default null, p_limite int default 200) returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
declare v jsonb;
begin
  perform planilla.exigir('ver');
  if not (planilla.capacidad('aprobacion') or planilla.capacidad('admin')) then
    raise exception 'PLA_PERMISO: la bitácora es para aprobación o administración de planilla';
  end if;
  select coalesce(jsonb_agg(t.x order by (t.x ->> 'id')::bigint desc), '[]'::jsonb) into v from (
    select jsonb_build_object('id', b.id, 'ocurrido_en', b.ocurrido_en, 'tabla', b.tabla, 'operacion', b.operacion,
      'empleado', af.nombre, 'actor', coalesce(ac.nombre, b.rol_bd), 'origen', b.origen, 'motivo', b.motivo,
      'antes', b.antes, 'despues', b.despues) as x
    from planilla.bitacora b
    left join public.empleados af on af.id = b.empleado_afectado
    left join public.empleados ac on ac.id = b.actor_empleado
    where p_empleado is null or b.empleado_afectado = p_empleado
    order by b.id desc limit least(greatest(coalesce(p_limite, 200), 1), 1000)
  ) t;
  return v;
end $$;

-- ───────────── Administración de planilla (permisos y catálogos) ─────────────
create or replace function public.pla_permisos() returns jsonb
language plpgsql stable security definer set search_path = planilla, public as $$
begin
  perform planilla.exigir('admin');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', pe.id, 'empleado_id', pe.empleado_id, 'empleado', e.nombre,
      'nivel', pe.nivel, 'empresa_id', pe.empresa_id, 'empresa', em.nombre, 'creado_en', pe.creado_en)
      order by e.nombre, pe.nivel), '[]'::jsonb)
    from planilla.permisos pe join public.empleados e on e.id = pe.empleado_id
    left join public.empresas em on em.id = pe.empresa_id where pe.activo);
end $$;

create or replace function public.pla_permiso_otorgar(p_empleado uuid, p_nivel text, p_empresa text default null)
returns void language plpgsql security definer set search_path = planilla, public as $$
declare v_yo uuid;
begin
  v_yo := planilla.exigir('admin');
  perform set_config('planilla.origen', 'pla_permiso_otorgar', true);
  if not exists (select 1 from public.empleados where id = p_empleado and activo) then
    raise exception 'El empleado no existe o está inactivo';
  end if;
  if exists (select 1 from planilla.permisos where empleado_id = p_empleado and nivel = p_nivel and activo
             and coalesce(empresa_id, '*') = coalesce(p_empresa, '*')) then
    raise exception 'Esa persona ya tiene ese permiso';
  end if;
  insert into planilla.permisos (empleado_id, nivel, empresa_id, otorgado_por) values (p_empleado, p_nivel, p_empresa, v_yo);
end $$;

create or replace function public.pla_permiso_revocar(p_id uuid)
returns void language plpgsql security definer set search_path = planilla, public as $$
declare v_p planilla.permisos;
begin
  perform planilla.exigir('admin');
  perform set_config('planilla.origen', 'pla_permiso_revocar', true);
  select * into v_p from planilla.permisos where id = p_id and activo for update;
  if not found then raise exception 'Permiso no encontrado'; end if;
  if v_p.nivel = 'admin' and (select count(*) from planilla.permisos where nivel = 'admin' and activo) <= 1 then
    raise exception 'No puedes revocar al último administrador de planilla';
  end if;
  update planilla.permisos set activo = false where id = p_id;
end $$;

create or replace function public.pla_clase_guardar(p_id uuid, p_nombre text, p_activa boolean default true)
returns void language plpgsql security definer set search_path = planilla, public as $$
begin
  perform planilla.exigir('admin');
  perform set_config('planilla.origen', 'pla_clase_guardar', true);
  if coalesce(btrim(p_nombre), '') = '' then raise exception 'Escribe el nombre de la clase'; end if;
  if p_id is null then
    insert into planilla.cat_clases (nombre, activa) values (btrim(p_nombre), coalesce(p_activa, true));
  else
    update planilla.cat_clases set nombre = btrim(p_nombre), activa = coalesce(p_activa, true) where id = p_id;
  end if;
end $$;

create or replace function public.pla_banco_guardar(p_id uuid, p_nombre text, p_pais text default null, p_activo boolean default true)
returns void language plpgsql security definer set search_path = planilla, public as $$
begin
  perform planilla.exigir('admin');
  perform set_config('planilla.origen', 'pla_banco_guardar', true);
  if coalesce(btrim(p_nombre), '') = '' then raise exception 'Escribe el nombre del banco'; end if;
  if p_id is null then
    insert into planilla.cat_bancos (nombre, pais, activo) values (btrim(p_nombre), p_pais, coalesce(p_activo, true));
  else
    update planilla.cat_bancos set nombre = btrim(p_nombre), pais = p_pais, activo = coalesce(p_activo, true) where id = p_id;
  end if;
end $$;

-- Solo usuarios autenticados pueden invocar las funciones públicas; el
-- esquema privado no se concede a nadie.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'pla\_%' loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'planilla' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

-- ───────────────────────── Datos iniciales ─────────────────────────
insert into planilla.cat_conceptos (id, nombre, tipo, orden) values
  ('salario_base', 'Salario base', 'ingreso', 10),
  ('viatico', 'Viático', 'ingreso', 20),
  ('otros_pagos', 'Otros pagos', 'ingreso', 30),
  ('prestamo_empleado', 'Préstamo a empleado', 'deduccion', 10),
  ('otra_deduccion', 'Otra deducción', 'deduccion', 90);

insert into planilla.cat_bancos (nombre, pais) values
  ('Banco LAFISE Panamá', 'PA'),
  ('Banco LAFISE Bancentro (Nicaragua)', 'NI'),
  ('BAC Nicaragua', 'NI'),
  ('Banpro', 'NI');

-- Empresa pagadora de arranque.
insert into public.empresas (id, nombre) values ('clovertale', 'Clovertale') on conflict (id) do nothing;

-- Designados por Tomás (13-nov-2026): Jhonny prepara, Tomás aprueba y administra.
insert into planilla.permisos (empleado_id, nivel)
select id, 'preparacion' from public.empleados where email = 'jhonny.vasquez@infarma.hn';
insert into planilla.permisos (empleado_id, nivel)
select e.id, n.nivel from public.empleados e cross join (values ('aprobacion'), ('admin')) n(nivel)
where e.email = 'tomas.sanchez@ampmcentroamerica.com';
