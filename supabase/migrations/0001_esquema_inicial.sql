-- =====================================================================
-- Plataforma de Ausencias — Esquema inicial para Supabase (Postgres)
-- Refleja el modelo de dominio del prototipo (src/domain/types.ts).
-- El saldo NO se guarda: se calcula en el cliente con la lógica de
-- src/domain/acumulacion.ts a partir de estas tablas.
-- =====================================================================

-- ---------- Catálogos ----------

create table paises (
  codigo        text primary key,                 -- 'NI', 'HN', 'SV', 'PA'
  nombre        text not null,
  bandera       text not null,
  fin_de_semana int[] not null default '{0,6}',   -- Date.getDay(): 0=domingo…6=sábado
  metodo_conteo text not null
    check (metodo_conteo in ('laborables', 'corridos_sin_feriados', 'corridos'))
);

create table tipos_ausencia (
  id               text primary key,
  nombre           text not null,
  descuenta_saldo  boolean not null default false,
  afecta_nomina    boolean not null default false,
  requiere_adjunto boolean not null default false,
  tope_anual_dias  numeric,
  color            text not null default '#5B77D3',
  icono            text not null default '📌'
);

create table politicas_ausencia (
  id                  text primary key,
  nombre              text not null,
  pais                text not null references paises(codigo),
  tipo_ausencia_id    text not null references tipos_ausencia(id),
  metodo_acumulacion  text not null
    check (metodo_acumulacion in ('anual', 'mensual', 'quincenal')),
  dias_por_anio       numeric not null,
  reglas_antiguedad   jsonb not null default '[]',  -- [{aPartirDeAnios, diasExtra}]
  tope_multiplicador  numeric,
  carryover_max_dias  numeric,
  carryover_expira    jsonb,                        -- {mes, dia} o null
  unique (pais, tipo_ausencia_id)
);

create table feriados (
  id          uuid primary key default gen_random_uuid(),
  pais        text not null references paises(codigo),
  fecha       date not null,
  descripcion text not null,
  unique (pais, fecha)
);

-- ---------- Personas ----------

create table empleados (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  email         text not null unique,
  pais          text not null references paises(codigo),
  puesto        text not null default '',
  fecha_ingreso date not null,
  manager_id    uuid references empleados(id),
  rol           text not null default 'empleado'
    check (rol in ('admin', 'jefe', 'empleado')),
  activo        boolean not null default true,
  avatar_color  text not null default '#5B77D3',
  -- Vínculo con Supabase Auth: se llena al primer login con enlace mágico.
  auth_user_id  uuid unique references auth.users(id)
);

-- ---------- Movimientos ----------

create table solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  empleado_id          uuid not null references empleados(id),
  tipo_ausencia_id     text not null references tipos_ausencia(id),
  fecha_inicio         date not null,
  fecha_fin            date not null,   -- día anterior al reintegro
  fraccion_inicio      text not null default 'completo'
    check (fraccion_inicio in ('completo', 'manana', 'tarde')),
  fraccion_fin         text not null default 'completo'
    check (fraccion_fin in ('completo', 'manana', 'tarde')),
  medio_dias           int not null,    -- congelado al crear, según método del país
  estado               text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  comentario_empleado  text,
  comentario_aprobador text,
  adjunto_url          text,            -- Storage de Supabase (certificados)
  aprobador_id         uuid references empleados(id),
  creada_en            timestamptz not null default now(),
  resuelta_en          timestamptz,
  check (fecha_fin >= fecha_inicio)
);

create table ajustes_saldo (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references empleados(id),
  tipo_ausencia_id text not null references tipos_ausencia(id),
  medio_dias       int not null,        -- positivo suma, negativo resta
  motivo           text not null,
  fecha            date not null default current_date,
  actor_id         uuid not null references empleados(id)
);

-- Compensación: se reactiva para el reporte de provisión contable.
-- Historial versionado: nunca se sobreescribe (sección 4.2 del diseño).
create table compensaciones (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references empleados(id),
  fecha_efectiva date not null,
  moneda         text not null default 'USD',
  monto_base     numeric not null,
  motivo         text not null
);

-- ---------- Trazabilidad ----------

create table auditoria (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references empleados(id),
  accion    text not null,
  entidad   text not null,
  entidad_id text not null,
  detalle   text not null,
  timestamp timestamptz not null default now()
);

create table notificaciones (
  id           uuid primary key default gen_random_uuid(),
  para_id      uuid not null references empleados(id),
  mensaje      text not null,
  leida        boolean not null default false,
  solicitud_id uuid references solicitudes(id),
  timestamp    timestamptz not null default now()
);

create index idx_solicitudes_empleado on solicitudes(empleado_id, estado);
create index idx_solicitudes_estado on solicitudes(estado) where estado = 'pendiente';
create index idx_notificaciones_para on notificaciones(para_id, leida);
create index idx_auditoria_timestamp on auditoria(timestamp desc);

-- =====================================================================
-- Seguridad por fila (RLS) — las reglas de visibilidad de la sección 3.1:
--   · Empleado: ve lo suyo.
--   · Jefe: además ve las solicitudes y saldos de su equipo directo.
--   · Admin/RRHH: ve y administra todo. Compensación SOLO admin (y el propio).
-- =====================================================================

-- Funciones auxiliares (security definer para no recursar en las políticas)
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

alter table paises            enable row level security;
alter table tipos_ausencia    enable row level security;
alter table politicas_ausencia enable row level security;
alter table feriados          enable row level security;
alter table empleados         enable row level security;
alter table solicitudes       enable row level security;
alter table ajustes_saldo     enable row level security;
alter table compensaciones    enable row level security;
alter table auditoria         enable row level security;
alter table notificaciones    enable row level security;

-- Catálogos: lectura para todo usuario autenticado; escritura solo admin.
create policy catalogo_lectura on paises for select to authenticated using (true);
create policy catalogo_lectura_tipos on tipos_ausencia for select to authenticated using (true);
create policy tipos_escritura_admin on tipos_ausencia for all to authenticated
  using (soy_admin()) with check (soy_admin());
create policy catalogo_lectura_politicas on politicas_ausencia for select to authenticated using (true);
create policy catalogo_lectura_feriados on feriados for select to authenticated using (true);
create policy feriados_escritura_admin on feriados for all to authenticated
  using (soy_admin()) with check (soy_admin());

-- Empleados: el directorio (nombres, países, jerarquía) es visible para
-- todos los autenticados — no contiene datos sensibles. Escribe solo admin.
create policy empleados_lectura on empleados for select to authenticated using (true);
create policy empleados_escritura_admin on empleados for insert to authenticated
  with check (soy_admin());
create policy empleados_update_admin on empleados for update to authenticated
  using (soy_admin()) with check (soy_admin());

-- Solicitudes: propias, de mi equipo directo, o todas si soy admin.
create policy solicitudes_lectura on solicitudes for select to authenticated
  using (
    empleado_id = mi_empleado_id()
    or soy_jefe_de(empleado_id)
    or soy_admin()
  );
create policy solicitudes_crear on solicitudes for insert to authenticated
  with check (empleado_id = mi_empleado_id());
-- Resolver/cancelar: el aprobador (jefe directo o admin) o el dueño (cancelar).
create policy solicitudes_resolver on solicitudes for update to authenticated
  using (
    empleado_id = mi_empleado_id()
    or soy_jefe_de(empleado_id)
    or soy_admin()
  );

-- Ajustes de saldo: los ve el dueño, su jefe y el admin; solo crea el admin.
create policy ajustes_lectura on ajustes_saldo for select to authenticated
  using (
    empleado_id = mi_empleado_id()
    or soy_jefe_de(empleado_id)
    or soy_admin()
  );
create policy ajustes_crear_admin on ajustes_saldo for insert to authenticated
  with check (soy_admin());

-- Compensación: SOLO admin ve todas; cada quien la propia. El jefe NO.
create policy compensacion_lectura on compensaciones for select to authenticated
  using (empleado_id = mi_empleado_id() or soy_admin());
create policy compensacion_escritura_admin on compensaciones for insert to authenticated
  with check (soy_admin());

-- Auditoría: inserta cualquier autenticado (sus propias acciones); lee admin.
create policy auditoria_insertar on auditoria for insert to authenticated
  with check (actor_id = mi_empleado_id());
create policy auditoria_lectura_admin on auditoria for select to authenticated
  using (soy_admin());

-- Notificaciones: cada quien las suyas; cualquiera puede generar una para otro
-- (el flujo de solicitud notifica al aprobador).
create policy notificaciones_lectura on notificaciones for select to authenticated
  using (para_id = mi_empleado_id());
create policy notificaciones_crear on notificaciones for insert to authenticated
  with check (true);
create policy notificaciones_marcar on notificaciones for update to authenticated
  using (para_id = mi_empleado_id()) with check (para_id = mi_empleado_id());
