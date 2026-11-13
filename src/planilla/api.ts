// Capa de acceso de Planilla: cada llamada es una función del servidor que
// verifica permiso y segundo factor. Los errores con prefijo PLA_ se traducen
// a un código para que la interfaz sepa reaccionar (pedir el segundo factor,
// avisar falta de permiso, etc.).

import { supabase } from '../lib/supabase'
import type {
  AccesoPlanilla, Catalogos, EntradaBitacora, Ficha, Historial, NivelPlanilla, Permiso, Solicitud, TipoSolicitud,
} from './tipos'

export type CodigoError = 'MFA' | 'PERMISO' | 'SESION' | 'OTRO'

export class ErrorPlanilla extends Error {
  codigo: CodigoError
  constructor(mensaje: string, codigo: CodigoError) {
    super(mensaje)
    this.codigo = codigo
  }
}

function traducir(error: { message?: string }): ErrorPlanilla {
  const texto = error.message ?? 'Error inesperado'
  const hallado = /^PLA_(MFA|PERMISO|SESION):\s*(.*)$/s.exec(texto)
  if (hallado) return new ErrorPlanilla(hallado[2], hallado[1] as CodigoError)
  return new ErrorPlanilla(texto, 'OTRO')
}

async function llamar<T>(funcion: string, argumentos?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(funcion, argumentos)
  if (error) throw traducir(error)
  return data as T
}

export const api = {
  miAcceso: () => llamar<AccesoPlanilla>('pla_mi_acceso'),
  catalogos: () => llamar<Catalogos>('pla_catalogos'),
  fichas: () => llamar<Ficha[]>('pla_fichas'),
  historial: (empleadoId: string) => llamar<Historial>('pla_ficha_historial', { p_empleado: empleadoId }),
  solicitudes: (estado: 'pendiente' | 'todas') => llamar<Solicitud[]>('pla_solicitudes', { p_estado: estado }),

  crearSolicitud: (datos: {
    empleadoId: string
    tipo: TipoSolicitud
    payload: unknown
    vigenteDesde: string
    motivo: string
    numeroCuenta?: string
  }) =>
    llamar<string>('pla_solicitud_crear', {
      p_empleado: datos.empleadoId,
      p_tipo: datos.tipo,
      p_payload: datos.payload,
      p_vigente_desde: datos.vigenteDesde,
      p_motivo: datos.motivo,
      p_numero_cuenta: datos.numeroCuenta ?? null,
    }),

  resolverSolicitud: (id: string, aprobar: boolean, comentario?: string) =>
    llamar<null>('pla_solicitud_resolver', { p_id: id, p_aprobar: aprobar, p_comentario: comentario ?? null }),

  cancelarSolicitud: (id: string) => llamar<null>('pla_solicitud_cancelar', { p_id: id }),

  /** Devuelve el número completo; cada llamada queda en la bitácora. */
  revelarCuenta: (origen: { empleadoId?: string; solicitudId?: string }, motivo: string) =>
    llamar<string>('pla_revelar_cuenta', {
      p_empleado: origen.empleadoId ?? null,
      p_solicitud: origen.solicitudId ?? null,
      p_motivo: motivo,
    }),

  bitacora: (empleadoId?: string) =>
    llamar<EntradaBitacora[]>('pla_bitacora', { p_empleado: empleadoId ?? null, p_limite: 300 }),

  permisos: () => llamar<Permiso[]>('pla_permisos'),
  otorgarPermiso: (empleadoId: string, nivel: NivelPlanilla, empresaId?: string) =>
    llamar<null>('pla_permiso_otorgar', { p_empleado: empleadoId, p_nivel: nivel, p_empresa: empresaId ?? null }),
  revocarPermiso: (id: string) => llamar<null>('pla_permiso_revocar', { p_id: id }),

  guardarClase: (id: string | null, nombre: string, activa = true) =>
    llamar<null>('pla_clase_guardar', { p_id: id, p_nombre: nombre, p_activa: activa }),
  guardarBanco: (id: string | null, nombre: string, pais: string | null, activo = true) =>
    llamar<null>('pla_banco_guardar', { p_id: id, p_nombre: nombre, p_pais: pais, p_activo: activo }),
}

export function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado'
}
