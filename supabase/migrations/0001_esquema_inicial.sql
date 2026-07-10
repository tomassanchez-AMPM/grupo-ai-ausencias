-- Plataforma de Ausencias — esquema inicial (espejo de src/domain/types.ts)
-- Aplicada en Supabase como 20260710161333_esquema_inicial

create table paises (
  codigo        text primary key,
  nombre        text not null,
  bandera       text not null,
  fin_de_semana int[] not null default '{0,6}',
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
  reglas_antiguedad   jsonb not null default '[]',
  tope_multiplicador  numeric,
  carryover_max_dias  numeric,
  carryover_expira    jsonb,
  unique (pais, tipo_ausencia_id)
);

create table feriados (
  id          uuid primary key default gen_random_uuid(),
  pais        text not null references paises(codigo),
  fecha       date not null,
  descripcion text not null,
  unique (pais, fecha)
);

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
  auth_user_id  uuid unique references auth.users(id)
);

create table solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  empleado_id          uuid not null references empleados(id),
  tipo_ausencia_id     text not null references tipos_ausencia(id),
  fecha_inicio         date not null,
  fecha_fin            date not null,
  fraccion_inicio      text not null default 'completo'
    check (fraccion_inicio in ('completo', 'manana', 'tarde')),
  fraccion_fin         text not null default 'completo'
    check (fraccion_fin in ('completo', 'manana', 'tarde')),
  medio_dias           int not null check (medio_dias > 0),
  estado               text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  comentario_empleado  text,
  comentario_aprobador text,
  adjunto_url          text,
  aprobador_id         uuid references empleados(id),
  creada_en            timestamptz not null default now(),
  resuelta_en          timestamptz,
  check (fecha_fin >= fecha_inicio)
);

create table ajustes_saldo (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references empleados(id),
  tipo_ausencia_id text not null references tipos_ausencia(id),
  medio_dias       int not null,
  motivo           text not null,
  fecha            date not null default current_date,
  actor_id         uuid not null references empleados(id)
);

create table compensaciones (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references empleados(id),
  fecha_efectiva date not null,
  moneda         text not null default 'USD',
  monto_base     numeric not null check (monto_base >= 0),
  motivo         text not null
);

create table auditoria (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references empleados(id),
  accion     text not null,
  entidad    text not null,
  entidad_id text not null,
  detalle    text not null,
  timestamp  timestamptz not null default now()
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
create index idx_solicitudes_pendientes on solicitudes(estado) where estado = 'pendiente';
create index idx_notificaciones_para on notificaciones(para_id, leida);
create index idx_auditoria_timestamp on auditoria(timestamp desc);
create index idx_empleados_manager on empleados(manager_id);
create index idx_feriados_pais on feriados(pais, fecha);
