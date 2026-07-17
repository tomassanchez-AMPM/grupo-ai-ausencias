// Modelo de datos — refleja la sección 4 del documento de diseño.
// El saldo NUNCA se guarda: se calcula (ver accrual.ts / balance.ts).

export type Rol = 'admin' | 'jefe' | 'empleado'

export type CodigoPais = 'NI' | 'HN' | 'SV' | 'PA'

/** Cómo descuenta días una solicitud — configurable por país (decisión de Tomás):
 *  NI: corridos sin feriados (cuenta fines de semana, salta feriados)
 *  HN: laborables (salta fines de semana y feriados) */
export type MetodoConteo = 'laborables' | 'corridos_sin_feriados' | 'corridos'

export interface Pais {
  codigo: CodigoPais
  nombre: string
  bandera: string
  /** Días de fin de semana según Date.getDay(): 0=domingo … 6=sábado */
  finDeSemana: number[]
  metodoConteo: MetodoConteo
}

export interface Feriado {
  id: string
  pais: CodigoPais
  fecha: string // YYYY-MM-DD
  descripcion: string
  /** true = solo medio día es feriado (ej. miércoles y sábado del
   *  Feriado Morazánico hondureño: asueto desde/hasta las 12:00 M). */
  medioDia: boolean
}

export interface TipoAusencia {
  id: string
  nombre: string
  descuentaSaldo: boolean
  afectaNomina: boolean
  requiereAdjunto: boolean
  /** Tope de días al año para tipos sin saldo acumulable (ej. enfermedad). */
  topeAnualDias?: number
  color: string
  icono: string
}

export type MetodoAcumulacion = 'anual' | 'mensual' | 'quincenal'

export interface ReglaAntiguedad {
  aPartirDeAnios: number
  diasExtra: number
}

/** El núcleo de la customización: una política = país + tipo de ausencia. */
export interface PoliticaAusencia {
  id: string
  nombre: string
  pais: CodigoPais
  tipoAusenciaId: string
  metodoAcumulacion: MetodoAcumulacion
  diasPorAnio: number
  /** Tramos acumulativos: se aplica el mayor tramo alcanzado. */
  reglasAntiguedad: ReglaAntiguedad[]
  /** Máximo acumulable = tope × días anuales. Sin valor = sin tope. */
  topeMultiplicador?: number
  /** Días máximos que se arrastran al año siguiente. */
  carryoverMaxDias?: number
  /** Fecha (mes/día) en que expira el carryover. Sin valor = no expira. */
  carryoverExpira?: { mes: number; dia: number }
}

export interface Empleado {
  id: string
  nombre: string
  email: string
  pais: CodigoPais
  puesto: string
  fechaIngreso: string // YYYY-MM-DD
  /** Aprobador. null = sin jefe → aprueba el admin designado. */
  managerId: string | null
  rol: Rol
  activo: boolean
  avatarColor: string
}

export type Fraccion = 'completo' | 'manana' | 'tarde'

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'

export interface SolicitudAusencia {
  id: string
  empleadoId: string
  tipoAusenciaId: string
  fechaInicio: string
  fechaFin: string
  /** En solicitudes de un solo día manda fraccionInicio. */
  fraccionInicio: Fraccion
  fraccionFin: Fraccion
  /** Unidad interna fina (sección 5.3): medios días descontables, calculados
   *  al crear según el método de conteo del país. */
  medioDias: number
  estado: EstadoSolicitud
  comentarioEmpleado?: string
  comentarioAprobador?: string
  adjuntoNombre?: string
  creadaEn: string // ISO
  resueltaEn?: string
  aprobadorId?: string
}

/** Ajuste manual de saldo (Nivel 1 — autoservicio del admin). */
export interface AjusteSaldo {
  id: string
  empleadoId: string
  tipoAusenciaId: string
  medioDias: number // positivo suma, negativo resta
  motivo: string
  fecha: string // YYYY-MM-DD
  actorId: string
}

/** Salario base versionado: nunca se sobreescribe, se agrega un registro.
 *  Reactivado para el reporte de provisión contable (solo admin). */
export interface Compensacion {
  id: string
  empleadoId: string
  fechaEfectiva: string
  moneda: string
  montoBase: number
  motivo: string
}

export interface RegistroAuditoria {
  id: string
  actorId: string
  accion: string
  entidad: string
  entidadId: string
  detalle: string
  timestamp: string
}

export interface Notificacion {
  id: string
  paraId: string
  mensaje: string
  leida: boolean
  timestamp: string
  solicitudId?: string
}

