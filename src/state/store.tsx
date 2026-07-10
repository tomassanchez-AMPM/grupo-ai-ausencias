// Estado global del prototipo. En producción esto sería la API + DB;
// aquí: React context + localStorage. Las ACCIONES replican el flujo de
// aprobación fijo de la sección 5.4 (validar → enrutar → notificar → auditar).

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { calcularSaldo, type DetalleSaldo } from '../domain/acumulacion'
import { contarMedioDias, formatearDias, reintegroDe } from '../domain/conteoDias'
import { formatearISO, formatearCorto, parseFecha } from '../domain/fechas'
import type {
  AjusteSaldo, CorreoSaliente, Empleado, Feriado, Fraccion, Notificacion,
  Pais, PoliticaAusencia, RegistroAuditoria, Rol, SolicitudAusencia, TipoAusencia,
} from '../domain/types'
import * as seed from '../data/seed'

// v5: descarta datos guardados por versiones sin <meta charset> (nombres
// corrompidos en localStorage). v4: identidad Humand.
const CLAVE_STORAGE = 'rrhh-prototipo-v5'

export interface DatosApp {
  empleados: Empleado[]
  tiposAusencia: TipoAusencia[]
  politicas: PoliticaAusencia[]
  paises: Pais[]
  feriados: Feriado[]
  solicitudes: SolicitudAusencia[]
  ajustes: AjusteSaldo[]
  auditoria: RegistroAuditoria[]
  notificaciones: Notificacion[]
  correos: CorreoSaliente[]
}

function datosIniciales(): DatosApp {
  return {
    empleados: seed.EMPLEADOS,
    tiposAusencia: seed.TIPOS_AUSENCIA,
    politicas: seed.POLITICAS,
    paises: seed.PAISES,
    feriados: seed.FERIADOS,
    solicitudes: seed.SOLICITUDES,
    ajustes: seed.AJUSTES,
    auditoria: seed.AUDITORIA,
    notificaciones: seed.NOTIFICACIONES,
    correos: seed.CORREOS,
  }
}

function cargar(): DatosApp {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE)
    if (crudo) return JSON.parse(crudo) as DatosApp
  } catch {
    // Datos corruptos → se restablece el seed.
  }
  return datosIniciales()
}

let contadorId = 0
function nuevoId(prefijo: string): string {
  contadorId += 1
  return `${prefijo}-${Date.now().toString(36)}-${contadorId}`
}

export interface NuevaSolicitud {
  empleadoId: string
  tipoAusenciaId: string
  fechaInicio: string
  fechaFin: string
  fraccionInicio: Fraccion
  fraccionFin: Fraccion
  comentario?: string
  adjuntoNombre?: string
}

interface StoreValor {
  datos: DatosApp
  hoy: string
  // Consultas derivadas
  paisDe: (empleado: Empleado) => Pais
  politicaDe: (empleado: Empleado, tipoAusenciaId: string) => PoliticaAusencia | undefined
  aprobadorDe: (empleado: Empleado) => Empleado
  saldoDe: (empleado: Empleado, tipoAusenciaId: string) => DetalleSaldo | undefined
  equipoDe: (jefeId: string) => Empleado[]
  pendientesDe: (aprobadorId: string) => SolicitudAusencia[]
  // Acciones
  crearSolicitud: (datos: NuevaSolicitud) => { ok: true } | { ok: false; error: string }
  resolverSolicitud: (id: string, aprobadorId: string, decision: 'aprobada' | 'rechazada', comentario?: string) => void
  cancelarSolicitud: (id: string) => void
  crearAjuste: (ajuste: Omit<AjusteSaldo, 'id'>) => void
  guardarEmpleado: (empleado: Empleado) => void
  guardarTipoAusencia: (tipo: TipoAusencia) => void
  agregarFeriado: (feriado: Omit<Feriado, 'id'>, actorId: string) => { ok: true } | { ok: false; error: string }
  eliminarFeriado: (id: string, actorId: string) => void
  marcarLeidas: (paraId: string) => void
  restablecer: () => void
}

const StoreContext = createContext<StoreValor | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosApp>(cargar)
  const hoy = formatearISO(new Date())

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos))
    } catch {
      // Entorno sin almacenamiento (p. ej. demo compartida): la sesión vive en memoria.
    }
  }, [datos])

  const valor = useMemo<StoreValor>(() => {
    const paisDe = (empleado: Empleado): Pais =>
      datos.paises.find((p) => p.codigo === empleado.pais) ?? datos.paises[0]

    const politicaDe = (empleado: Empleado, tipoAusenciaId: string) =>
      datos.politicas.find((p) => p.pais === empleado.pais && p.tipoAusenciaId === tipoAusenciaId)

    const aprobadorDe = (empleado: Empleado): Empleado => {
      const jefe = empleado.managerId
        ? datos.empleados.find((e) => e.id === empleado.managerId && e.activo)
        : undefined
      return (
        jefe ??
        datos.empleados.find((e) => e.id === seed.ADMIN_DESIGNADO_ID) ??
        datos.empleados.find((e) => e.rol === 'admin' && e.activo)!
      )
    }

    const saldoDe = (empleado: Empleado, tipoAusenciaId: string) => {
      const politica = politicaDe(empleado, tipoAusenciaId)
      if (!politica) return undefined
      return calcularSaldo(politica, empleado, hoy, datos.solicitudes, datos.ajustes)
    }

    const equipoDe = (jefeId: string) =>
      datos.empleados.filter((e) => e.managerId === jefeId && e.activo)

    const pendientesDe = (aprobadorId: string) =>
      datos.solicitudes.filter((s) => {
        if (s.estado !== 'pendiente') return false
        const solicitante = datos.empleados.find((e) => e.id === s.empleadoId)
        return solicitante ? aprobadorDe(solicitante).id === aprobadorId : false
      })

    const auditar = (actorId: string, accion: string, entidad: string, entidadId: string, detalle: string): RegistroAuditoria => ({
      id: nuevoId('aud'), actorId, accion, entidad, entidadId, detalle,
      timestamp: new Date().toISOString(),
    })

    const notificarYEnviar = (
      previo: DatosApp, para: Empleado, mensaje: string, asunto: string, solicitudId?: string,
    ): Pick<DatosApp, 'notificaciones' | 'correos'> => ({
      // Canal doble confirmado por Tomás: dentro de la app + correo.
      notificaciones: [
        { id: nuevoId('not'), paraId: para.id, mensaje, leida: false, timestamp: new Date().toISOString(), solicitudId },
        ...previo.notificaciones,
      ],
      correos: [
        { id: nuevoId('mail'), para: para.email, asunto, cuerpo: mensaje, timestamp: new Date().toISOString() },
        ...previo.correos,
      ],
    })

    const crearSolicitud = (entrada: NuevaSolicitud): { ok: true } | { ok: false; error: string } => {
      const empleado = datos.empleados.find((e) => e.id === entrada.empleadoId)
      if (!empleado) return { ok: false, error: 'Empleado no encontrado.' }
      const tipo = datos.tiposAusencia.find((t) => t.id === entrada.tipoAusenciaId)
      if (!tipo) return { ok: false, error: 'Tipo de ausencia no encontrado.' }
      if (parseFecha(entrada.fechaFin) < parseFecha(entrada.fechaInicio))
        return { ok: false, error: 'La fecha de fin no puede ser anterior a la de inicio.' }

      const pais = paisDe(empleado)
      const medioDias = contarMedioDias(entrada, pais, datos.feriados)
      if (medioDias === 0)
        return { ok: false, error: 'El rango elegido no descuenta ningún día (feriados o fin de semana). Ajusta las fechas.' }
      if (tipo.requiereAdjunto && !entrada.adjuntoNombre)
        return { ok: false, error: `${tipo.nombre} requiere un documento adjunto (ej. certificado).` }

      // Validación automática de saldo (paso 2 del flujo fijo).
      if (tipo.descuentaSaldo) {
        const saldo = saldoDe(empleado, tipo.id)
        if (saldo && medioDias > saldo.disponibleMedios - saldo.pendienteMedios) {
          const libre = Math.max(saldo.disponibleMedios - saldo.pendienteMedios, 0)
          return {
            ok: false,
            error: `Saldo insuficiente: la solicitud descuenta ${formatearDias(medioDias)} y tienes ${formatearDias(libre)} libres (contando pendientes).`,
          }
        }
      }
      if (tipo.topeAnualDias != null) {
        const usadoAnio = datos.solicitudes
          .filter((s) => s.empleadoId === empleado.id && s.tipoAusenciaId === tipo.id && s.estado !== 'rechazada' && s.estado !== 'cancelada' && s.fechaInicio.startsWith(hoy.slice(0, 4)))
          .reduce((t, s) => t + s.medioDias, 0)
        if (usadoAnio + medioDias > tipo.topeAnualDias * 2)
          return { ok: false, error: `Supera el tope anual de ${tipo.topeAnualDias} días para ${tipo.nombre}.` }
      }

      const aprobador = aprobadorDe(empleado)
      const solicitud: SolicitudAusencia = {
        id: nuevoId('sol'),
        empleadoId: empleado.id,
        tipoAusenciaId: tipo.id,
        fechaInicio: entrada.fechaInicio,
        fechaFin: entrada.fechaFin,
        fraccionInicio: entrada.fraccionInicio,
        fraccionFin: entrada.fraccionFin,
        medioDias,
        estado: 'pendiente',
        comentarioEmpleado: entrada.comentario || undefined,
        adjuntoNombre: entrada.adjuntoNombre,
        creadaEn: new Date().toISOString(),
      }

      const reintegro = reintegroDe(solicitud)
      const mensaje = `${empleado.nombre} solicitó ${tipo.nombre} desde el ${formatearCorto(entrada.fechaInicio)}, reintegro el ${formatearCorto(reintegro.fecha)}${reintegro.mediodia ? ' al mediodía' : ''} (${formatearDias(medioDias)}).`
      setDatos((prev) => ({
        ...prev,
        solicitudes: [solicitud, ...prev.solicitudes],
        ...notificarYEnviar(prev, aprobador, mensaje, `Nueva solicitud de ausencia — ${empleado.nombre}`, solicitud.id),
        auditoria: [auditar(empleado.id, 'creó', 'solicitud', solicitud.id, mensaje), ...prev.auditoria],
      }))
      return { ok: true }
    }

    const resolverSolicitud = (id: string, aprobadorId: string, decision: 'aprobada' | 'rechazada', comentario?: string) => {
      const solicitud = datos.solicitudes.find((s) => s.id === id)
      if (!solicitud || solicitud.estado !== 'pendiente') return
      const empleado = datos.empleados.find((e) => e.id === solicitud.empleadoId)
      const aprobador = datos.empleados.find((e) => e.id === aprobadorId)
      const tipo = datos.tiposAusencia.find((t) => t.id === solicitud.tipoAusenciaId)
      if (!empleado || !aprobador || !tipo) return
      const politica = politicaDe(empleado, tipo.id)

      const verbo = decision === 'aprobada' ? 'aprobó' : 'rechazó'
      const reintegro = reintegroDe(solicitud)
      const mensaje = `${aprobador.nombre} ${verbo} tu solicitud de ${tipo.nombre} (desde el ${formatearCorto(solicitud.fechaInicio)}, reintegro el ${formatearCorto(reintegro.fecha)}).${comentario ? ` Comentario: "${comentario}"` : ''}`

      setDatos((prev) => ({
        ...prev,
        solicitudes: prev.solicitudes.map((s) =>
          s.id === id
            ? { ...s, estado: decision, aprobadorId, comentarioAprobador: comentario || undefined, resueltaEn: new Date().toISOString() }
            : s,
        ),
        ...notificarYEnviar(prev, empleado, mensaje, `Tu solicitud fue ${decision} — ${tipo.nombre}`, id),
        // Sello inmutable: quién, cuándo y bajo qué política (sección 7.1).
        auditoria: [
          auditar(aprobadorId, verbo, 'solicitud', id,
            `${tipo.nombre} de ${empleado.nombre} (${formatearDias(solicitud.medioDias)}) — política ${politica?.nombre ?? 'n/a'}`),
          ...prev.auditoria,
        ],
      }))
    }

    const cancelarSolicitud = (id: string) => {
      const solicitud = datos.solicitudes.find((s) => s.id === id)
      if (!solicitud || solicitud.estado !== 'pendiente') return
      setDatos((prev) => ({
        ...prev,
        solicitudes: prev.solicitudes.map((s) => (s.id === id ? { ...s, estado: 'cancelada' as const } : s)),
        auditoria: [auditar(solicitud.empleadoId, 'canceló', 'solicitud', id, 'Cancelada por el solicitante antes de resolverse'), ...prev.auditoria],
      }))
    }

    const crearAjuste = (ajuste: Omit<AjusteSaldo, 'id'>) => {
      const empleado = datos.empleados.find((e) => e.id === ajuste.empleadoId)
      const completo: AjusteSaldo = { ...ajuste, id: nuevoId('aj') }
      setDatos((prev) => ({
        ...prev,
        ajustes: [completo, ...prev.ajustes],
        auditoria: [
          auditar(ajuste.actorId, 'ajustó saldo', 'ajuste', completo.id,
            `${ajuste.medioDias > 0 ? '+' : ''}${formatearDias(Math.abs(ajuste.medioDias))} a ${empleado?.nombre ?? ajuste.empleadoId} — ${ajuste.motivo}`),
          ...prev.auditoria,
        ],
      }))
    }

    const guardarEmpleado = (empleado: Empleado) => {
      setDatos((prev) => {
        const existe = prev.empleados.some((e) => e.id === empleado.id)
        return {
          ...prev,
          empleados: existe
            ? prev.empleados.map((e) => (e.id === empleado.id ? empleado : e))
            : [...prev.empleados, empleado],
        }
      })
    }

    const guardarTipoAusencia = (tipo: TipoAusencia) => {
      setDatos((prev) => {
        const existe = prev.tiposAusencia.some((t) => t.id === tipo.id)
        return {
          ...prev,
          tiposAusencia: existe
            ? prev.tiposAusencia.map((t) => (t.id === tipo.id ? tipo : t))
            : [...prev.tiposAusencia, tipo],
        }
      })
    }

    const agregarFeriado = (feriado: Omit<Feriado, 'id'>, actorId: string): { ok: true } | { ok: false; error: string } => {
      if (!feriado.fecha) return { ok: false, error: 'Indica la fecha del feriado.' }
      if (!feriado.descripcion.trim()) return { ok: false, error: 'Indica el nombre del feriado.' }
      const duplicado = datos.feriados.some((f) => f.pais === feriado.pais && f.fecha === feriado.fecha)
      if (duplicado) return { ok: false, error: 'Ya existe un feriado en esa fecha para este país.' }

      const completo: Feriado = { ...feriado, descripcion: feriado.descripcion.trim(), id: nuevoId('fer') }
      const pais = datos.paises.find((p) => p.codigo === feriado.pais)
      setDatos((prev) => ({
        ...prev,
        feriados: [...prev.feriados, completo],
        auditoria: [
          auditar(actorId, 'agregó feriado', 'feriado', completo.id,
            `${pais?.nombre ?? feriado.pais}: ${formatearCorto(feriado.fecha)} — ${completo.descripcion}`),
          ...prev.auditoria,
        ],
      }))
      return { ok: true }
    }

    const eliminarFeriado = (id: string, actorId: string) => {
      const feriado = datos.feriados.find((f) => f.id === id)
      if (!feriado) return
      const pais = datos.paises.find((p) => p.codigo === feriado.pais)
      setDatos((prev) => ({
        ...prev,
        feriados: prev.feriados.filter((f) => f.id !== id),
        auditoria: [
          auditar(actorId, 'eliminó feriado', 'feriado', id,
            `${pais?.nombre ?? feriado.pais}: ${formatearCorto(feriado.fecha)} — ${feriado.descripcion}`),
          ...prev.auditoria,
        ],
      }))
    }

    const marcarLeidas = (paraId: string) => {
      setDatos((prev) => ({
        ...prev,
        notificaciones: prev.notificaciones.map((n) => (n.paraId === paraId ? { ...n, leida: true } : n)),
      }))
    }

    const restablecer = () => setDatos(datosIniciales())

    return {
      datos, hoy, paisDe, politicaDe, aprobadorDe, saldoDe, equipoDe, pendientesDe,
      crearSolicitud, resolverSolicitud, cancelarSolicitud, crearAjuste,
      guardarEmpleado, guardarTipoAusencia, agregarFeriado, eliminarFeriado,
      marcarLeidas, restablecer,
    }
  }, [datos, hoy])

  return <StoreContext.Provider value={valor}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValor {
  const contexto = useContext(StoreContext)
  if (!contexto) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return contexto
}

export type { Rol }
