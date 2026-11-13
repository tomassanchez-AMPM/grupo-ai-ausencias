// Tipos del módulo de Planilla. Reflejan lo que devuelven las funciones
// `pla_*` del servidor; el navegador nunca consulta las tablas directamente.

export type NivelPlanilla = 'consulta' | 'preparacion' | 'aprobacion' | 'tesoreria' | 'admin'

export interface AccesoPlanilla {
  empleado_id: string | null
  tiene_acceso: boolean
  aal2: boolean
  niveles: NivelPlanilla[]
}

export type Frecuencia = 'mensual' | 'quincenal' | 'semanal'
export type EstadoFicha = 'activa' | 'suspendida' | 'baja'

export interface DatosGenerales {
  legislacion: string
  frecuencia_pago: Frecuencia
  moneda: string
  fecha_ingreso_original: string
  fecha_ultima_liquidacion?: string | null
  estado?: EstadoFicha
}

export interface ItemCompensacion {
  concepto_id: string
  concepto?: string
  descripcion?: string | null
  monto: number
  moneda: string
}

export interface ItemPagador {
  empresa_id: string
  empresa?: string
  porcentaje: number
}

export interface ItemClase {
  clase_id: string
  clase?: string
  porcentaje: number
}

export interface DatosCuenta {
  banco_id: string
  banco?: string
  tipo_cuenta: 'ahorro' | 'corriente'
  moneda: string
  titular: string
  identificacion?: string | null
  ultimos4?: string
}

export interface ItemDeduccion {
  concepto_id: string
  concepto?: string
  descripcion?: string | null
  monto_periodo: number
  moneda: string
  es_prestamo: boolean
  monto_original?: number | null
  saldo_inicial?: number | null
}

export interface Ficha extends DatosGenerales {
  empleado_id: string
  nombre: string
  puesto: string
  empresa_asignada: string | null
  estado: EstadoFicha
  compensacion: ItemCompensacion[]
  pagadores: ItemPagador[]
  clases: ItemClase[]
  cuenta: DatosCuenta | null
  deducciones: ItemDeduccion[]
  pendientes: number
}

export type TipoSolicitud = 'alta' | 'general' | 'compensacion' | 'pagadores' | 'clases' | 'cuenta' | 'deducciones'
export type Seccion = Exclude<TipoSolicitud, 'alta'>

export interface PayloadAlta {
  general: DatosGenerales
  compensacion: ItemCompensacion[]
  pagadores: ItemPagador[]
  clases: ItemClase[]
  cuenta?: DatosCuenta
  deducciones?: ItemDeduccion[]
}

export interface Solicitud {
  id: string
  tipo: TipoSolicitud
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  empleado_id: string
  empleado: string
  payload: unknown
  trae_cuenta: boolean
  vigente_desde: string
  motivo: string
  propuesta_por_id: string
  propuesta_por: string
  propuesta_en: string
  resuelta_por: string | null
  resuelta_en: string | null
  comentario_resolucion: string | null
  /** Valor vigente de la sección (para comparar antes → propuesto). */
  actual: unknown
}

export interface Catalogos {
  empresas: { id: string; nombre: string }[]
  legislaciones: { codigo: string; nombre: string }[]
  clases: { id: string; nombre: string; activa: boolean }[]
  bancos: { id: string; nombre: string; pais: string | null; activo: boolean }[]
  conceptos: { id: string; nombre: string; tipo: 'ingreso' | 'deduccion' }[]
  empleados_sin_ficha: { id: string; nombre: string; fecha_ingreso: string; pais: string; empresa_id: string }[]
}

export interface Historial {
  compensacion: (ItemCompensacion & Vigencia)[]
  pagadores: (ItemPagador & Vigencia)[]
  clases: (ItemClase & Vigencia)[]
  cuenta: (DatosCuenta & Vigencia)[]
  deducciones: (ItemDeduccion & Vigencia)[]
}

export interface Vigencia {
  vigente_desde: string
  vigente_hasta: string | null
}

export interface EntradaBitacora {
  id: number
  ocurrido_en: string
  tabla: string
  operacion: string
  empleado: string | null
  actor: string
  origen: string
  motivo: string | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
}

export interface Permiso {
  id: string
  empleado_id: string
  empleado: string
  nivel: NivelPlanilla
  empresa_id: string | null
  empresa: string | null
  creado_en: string
}

export const MONEDAS = ['USD', 'NIO', 'HNL', 'PAB'] as const

export const NOMBRE_NIVEL: Record<NivelPlanilla, string> = {
  consulta: 'Consulta',
  preparacion: 'Preparación',
  aprobacion: 'Aprobación',
  tesoreria: 'Tesorería',
  admin: 'Administración de planilla',
}

export const NOMBRE_TIPO: Record<TipoSolicitud, string> = {
  alta: 'Alta de ficha',
  general: 'Datos generales',
  compensacion: 'Compensación',
  pagadores: 'Empresas pagadoras',
  clases: 'Clases',
  cuenta: 'Cuenta bancaria',
  deducciones: 'Deducciones',
}
