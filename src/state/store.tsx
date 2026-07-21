// Estado global respaldado por Supabase. La seguridad real vive en las
// políticas RLS de la base (supabase/migrations): este cliente solo recibe
// las filas que el usuario autenticado tiene derecho a ver. El flujo de
// aprobación replica la sección 5.4: validar → enrutar → notificar → auditar.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { calcularSaldo, type DetalleSaldo } from '../domain/acumulacion'
import { contarMedioDias, formatearDias, reintegroDe } from '../domain/conteoDias'
import { formatearISO, formatearCorto, parseFecha } from '../domain/fechas'
import type {
  AjusteSaldo, Empleado, Feriado, Fraccion, Notificacion,
  Pais, PoliticaAusencia, RegistroAuditoria, SolicitudAusencia, TipoAusencia,
} from '../domain/types'
import * as filas from './filas'

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
}

const DATOS_VACIOS: DatosApp = {
  empleados: [], tiposAusencia: [], politicas: [], paises: [], feriados: [],
  solicitudes: [], ajustes: [], auditoria: [], notificaciones: [],
}

export type EstadoSesion =
  | { fase: 'cargando' }
  | { fase: 'anonimo' }
  /** Hay login pero el correo no corresponde a ningún empleado registrado. */
  | { fase: 'sin_registro'; email: string }
  | { fase: 'activa'; empleado: Empleado }

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

type Resultado = { ok: true } | { ok: false; error: string }

interface StoreValor {
  sesion: EstadoSesion
  datos: DatosApp
  hoy: string
  cargandoDatos: boolean
  // Consultas derivadas
  paisDe: (empleado: Empleado) => Pais
  politicaDe: (empleado: Empleado, tipoAusenciaId: string) => PoliticaAusencia | undefined
  aprobadorDe: (empleado: Empleado) => Empleado | undefined
  saldoDe: (empleado: Empleado, tipoAusenciaId: string) => DetalleSaldo | undefined
  equipoDe: (jefeId: string) => Empleado[]
  pendientesDe: (aprobadorId: string) => SolicitudAusencia[]
  // Autenticación
  entrarConCorreo: (email: string) => Promise<Resultado>
  /** Entrada con el código numérico del correo (el correo no lleva enlace:
   *  los escáneres corporativos lo detonarían y el token es el mismo). */
  entrarConCodigo: (email: string, codigo: string) => Promise<Resultado>
  cerrarSesion: () => Promise<void>
  // Acciones (todas contra Supabase; refrescan los datos al terminar)
  recargar: () => Promise<void>
  crearSolicitud: (datos: NuevaSolicitud) => Promise<Resultado>
  resolverSolicitud: (id: string, decision: 'aprobada' | 'rechazada', comentario?: string) => Promise<Resultado>
  cancelarSolicitud: (id: string) => Promise<Resultado>
  crearAjuste: (ajuste: Omit<AjusteSaldo, 'id' | 'actorId' | 'fecha'>) => Promise<Resultado>
  guardarEmpleado: (empleado: Empleado, esNuevo: boolean) => Promise<Resultado>
  guardarTipoAusencia: (tipo: TipoAusencia, esNuevo: boolean) => Promise<Resultado>
  agregarFeriado: (feriado: Omit<Feriado, 'id'>) => Promise<Resultado>
  eliminarFeriado: (id: string) => Promise<Resultado>
  marcarLeidas: () => Promise<void>
}

const StoreContext = createContext<StoreValor | null>(null)

function mensajeDeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Error inesperado. Intenta de nuevo.'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ fase: 'cargando' })
  const [datos, setDatos] = useState<DatosApp>(DATOS_VACIOS)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const hoy = formatearISO(new Date())
  const empleadoActualRef = useRef<Empleado | null>(null)

  const cargarDatos = useCallback(async () => {
    setCargandoDatos(true)
    try {
      // RLS recorta cada consulta a lo que el usuario puede ver.
      const [paises, tipos, politicas, feriados, empleados, solicitudes, ajustes, auditoria, notificaciones] =
        await Promise.all([
          supabase.from('paises').select('*').order('nombre'),
          supabase.from('tipos_ausencia').select('*').order('nombre'),
          supabase.from('politicas_ausencia').select('*'),
          supabase.from('feriados').select('*').order('fecha'),
          supabase.from('empleados').select('*').order('nombre'),
          supabase.from('solicitudes').select('*').order('creada_en', { ascending: false }),
          supabase.from('ajustes_saldo').select('*'),
          supabase.from('auditoria').select('*').order('timestamp', { ascending: false }).limit(500),
          supabase.from('notificaciones').select('*').order('timestamp', { ascending: false }).limit(100),
        ])
      const primerError = [paises, tipos, politicas, feriados, empleados, solicitudes, ajustes, auditoria, notificaciones]
        .map((r) => r.error)
        .find(Boolean)
      if (primerError) throw primerError

      setDatos({
        paises: (paises.data ?? []).map(filas.aPais),
        tiposAusencia: (tipos.data ?? []).map(filas.aTipoAusencia),
        politicas: (politicas.data ?? []).map(filas.aPolitica),
        feriados: (feriados.data ?? []).map(filas.aFeriado),
        empleados: (empleados.data ?? []).map(filas.aEmpleado),
        solicitudes: (solicitudes.data ?? []).map(filas.aSolicitud),
        ajustes: (ajustes.data ?? []).map(filas.aAjuste),
        auditoria: (auditoria.data ?? []).map(filas.aAuditoria),
        notificaciones: (notificaciones.data ?? []).map(filas.aNotificacion),
      })
    } finally {
      setCargandoDatos(false)
    }
  }, [])

  // Resuelve la sesión: vincula el usuario de Auth con su fila de empleados
  // (por correo, la primera vez) y carga los datos visibles.
  const resolverSesion = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        empleadoActualRef.current = null
        setSesion({ fase: 'anonimo' })
        setDatos(DATOS_VACIOS)
        return
      }
      const { data, error } = await supabase.rpc('vincular_mi_usuario')
      if (error) throw error
      const fila = Array.isArray(data) ? data[0] : data
      if (!fila) {
        empleadoActualRef.current = null
        setSesion({ fase: 'sin_registro', email: session.user.email ?? '' })
        setDatos(DATOS_VACIOS)
        return
      }
      const empleado = filas.aEmpleado(fila)
      empleadoActualRef.current = empleado
      // Cargar los datos ANTES de activar la sesión: las vistas asumen que los
      // catálogos (países, tipos) ya existen cuando se montan.
      await cargarDatos()
      setSesion({ fase: 'activa', empleado })
    } catch (error) {
      // Fallo transitorio (red, timeout): conservar la sesión activa previa si
      // existía; si no, volver al login en lugar de quedar en "Cargando…".
      console.error('No se pudo resolver la sesión:', error)
      setSesion((previa) => (previa.fase === 'activa' ? previa : { fase: 'anonimo' }))
    }
  }, [cargarDatos])

  useEffect(() => {
    void resolverSesion()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') {
        // setTimeout evita el deadlock documentado de supabase-js: no se debe
        // llamar al cliente dentro del propio callback de auth.
        setTimeout(() => void resolverSesion(), 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [resolverSesion])

  // Notificaciones en tiempo real: al recibir una, refresca los datos.
  useEffect(() => {
    if (sesion.fase !== 'activa') return
    const canal = supabase
      .channel('notificaciones-propias')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `para_id=eq.${sesion.empleado.id}` },
        () => void cargarDatos(),
      )
      .subscribe()
    return () => void supabase.removeChannel(canal)
  }, [sesion, cargarDatos])

  const valor = useMemo<StoreValor>(() => {
    const paisDe = (empleado: Empleado): Pais =>
      datos.paises.find((p) => p.codigo === empleado.pais) ?? datos.paises[0]

    const politicaDe = (empleado: Empleado, tipoAusenciaId: string) =>
      datos.politicas.find((p) => p.pais === empleado.pais && p.tipoAusenciaId === tipoAusenciaId)

    const aprobadorDe = (empleado: Empleado): Empleado | undefined => {
      const jefe = empleado.managerId
        ? datos.empleados.find((e) => e.id === empleado.managerId && e.activo)
        : undefined
      return jefe ?? datos.empleados.find((e) => e.rol === 'admin' && e.activo)
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
        return solicitante ? aprobadorDe(solicitante)?.id === aprobadorId : false
      })

    const yo = () => empleadoActualRef.current

    const auditar = async (accion: string, entidad: string, entidadId: string, detalle: string) => {
      const actor = yo()
      if (!actor) return
      await supabase.from('auditoria').insert({
        actor_id: actor.id, accion, entidad, entidad_id: entidadId, detalle,
      })
    }

    const notificar = async (paraId: string, mensaje: string, solicitudId?: string) => {
      await supabase.from('notificaciones').insert({
        para_id: paraId, mensaje, solicitud_id: solicitudId ?? null,
      })
    }

    const entrarConCorreo = async (email: string): Promise<Resultado> => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if (error) return { ok: false, error: mensajeDeError(error) }
      return { ok: true }
    }

    const entrarConCodigo = async (email: string, codigo: string): Promise<Resultado> => {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codigo.trim(),
        type: 'email',
      })
      if (error) return { ok: false, error: mensajeDeError(error) }
      return { ok: true }
    }

    const cerrarSesion = async () => {
      await supabase.auth.signOut()
    }

    const crearSolicitud = async (entrada: NuevaSolicitud): Promise<Resultado> => {
      const empleado = yo()
      if (!empleado || empleado.id !== entrada.empleadoId)
        return { ok: false, error: 'Solo puedes crear solicitudes propias.' }
      const tipo = datos.tiposAusencia.find((t) => t.id === entrada.tipoAusenciaId)
      if (!tipo) return { ok: false, error: 'Tipo de ausencia no encontrado.' }
      if (parseFecha(entrada.fechaFin) < parseFecha(entrada.fechaInicio))
        return { ok: false, error: 'El rango de fechas es inválido.' }

      const pais = paisDe(empleado)
      const medioDias = contarMedioDias(entrada, pais, datos.feriados)
      if (medioDias === 0)
        return { ok: false, error: 'El rango elegido no descuenta ningún día (feriados o fin de semana). Ajusta las fechas.' }
      if (tipo.requiereAdjunto && !entrada.adjuntoNombre)
        return { ok: false, error: `${tipo.nombre} requiere un documento adjunto (ej. certificado).` }

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
          .filter((s) => s.empleadoId === empleado.id && s.tipoAusenciaId === tipo.id
            && s.estado !== 'rechazada' && s.estado !== 'cancelada'
            && s.fechaInicio.startsWith(hoy.slice(0, 4)))
          .reduce((t, s) => t + s.medioDias, 0)
        if (usadoAnio + medioDias > tipo.topeAnualDias * 2)
          return { ok: false, error: `Supera el tope anual de ${tipo.topeAnualDias} días para ${tipo.nombre}.` }
      }

      const { data: creada, error } = await supabase
        .from('solicitudes')
        .insert({
          empleado_id: empleado.id,
          tipo_ausencia_id: tipo.id,
          fecha_inicio: entrada.fechaInicio,
          fecha_fin: entrada.fechaFin,
          fraccion_inicio: entrada.fraccionInicio,
          fraccion_fin: entrada.fraccionFin,
          medio_dias: medioDias,
          comentario_empleado: entrada.comentario ?? null,
          adjunto_url: entrada.adjuntoNombre ?? null,
        })
        .select()
        .single()
      if (error) return { ok: false, error: mensajeDeError(error) }

      // La auditoría de solicitudes la escribe la base (trigger tg_auditar_solicitud).
      const aprobador = aprobadorDe(empleado)
      const reintegro = reintegroDe({ fechaFin: entrada.fechaFin, fraccionFin: entrada.fraccionFin })
      const mensaje = `${empleado.nombre} solicitó ${tipo.nombre} desde el ${formatearCorto(entrada.fechaInicio)}, reintegro el ${formatearCorto(reintegro.fecha)}${reintegro.mediodia ? ' al mediodía' : ''} (${formatearDias(medioDias)}).`
      if (aprobador && aprobador.id !== empleado.id) await notificar(aprobador.id, mensaje, creada.id)
      await cargarDatos()
      return { ok: true }
    }

    const resolverSolicitud = async (id: string, decision: 'aprobada' | 'rechazada', comentario?: string): Promise<Resultado> => {
      const actor = yo()
      const solicitud = datos.solicitudes.find((s) => s.id === id)
      if (!actor || !solicitud || solicitud.estado !== 'pendiente')
        return { ok: false, error: 'La solicitud ya fue resuelta.' }
      const empleado = datos.empleados.find((e) => e.id === solicitud.empleadoId)
      const tipo = datos.tiposAusencia.find((t) => t.id === solicitud.tipoAusenciaId)
      if (!empleado || !tipo) return { ok: false, error: 'Datos incompletos.' }

      const { data: actualizadas, error } = await supabase
        .from('solicitudes')
        .update({
          estado: decision,
          aprobador_id: actor.id,
          comentario_aprobador: comentario ?? null,
          resuelta_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('estado', 'pendiente')
        .select()
      if (error) return { ok: false, error: mensajeDeError(error) }
      if (!actualizadas || actualizadas.length === 0) {
        // Nadie la actualizó: otro aprobador se adelantó o fue cancelada.
        await cargarDatos()
        return { ok: false, error: 'La solicitud ya no está pendiente (alguien más la resolvió o fue cancelada).' }
      }

      // La auditoría con sello de política la escribe la base (trigger).
      const verbo = decision === 'aprobada' ? 'aprobó' : 'rechazó'
      const reintegro = reintegroDe(solicitud)
      await notificar(
        empleado.id,
        `${actor.nombre} ${verbo} tu solicitud de ${tipo.nombre} (desde el ${formatearCorto(solicitud.fechaInicio)}, reintegro el ${formatearCorto(reintegro.fecha)}).${comentario ? ` Comentario: "${comentario}"` : ''}`,
        id,
      )
      await cargarDatos()
      return { ok: true }
    }

    const cancelarSolicitud = async (id: string): Promise<Resultado> => {
      const solicitud = datos.solicitudes.find((s) => s.id === id)
      if (!solicitud || solicitud.estado !== 'pendiente')
        return { ok: false, error: 'Solo se cancelan solicitudes pendientes.' }
      const { data: actualizadas, error } = await supabase
        .from('solicitudes')
        .update({ estado: 'cancelada' })
        .eq('id', id)
        .eq('estado', 'pendiente')
        .select()
      if (error) return { ok: false, error: mensajeDeError(error) }
      if (!actualizadas || actualizadas.length === 0) {
        await cargarDatos()
        return { ok: false, error: 'La solicitud ya no está pendiente.' }
      }
      await cargarDatos()
      return { ok: true }
    }

    const crearAjuste = async (ajuste: Omit<AjusteSaldo, 'id' | 'actorId' | 'fecha'>): Promise<Resultado> => {
      const actor = yo()
      if (!actor) return { ok: false, error: 'Sesión no válida.' }
      const empleado = datos.empleados.find((e) => e.id === ajuste.empleadoId)
      const { data: creado, error } = await supabase
        .from('ajustes_saldo')
        .insert({
          empleado_id: ajuste.empleadoId,
          tipo_ausencia_id: ajuste.tipoAusenciaId,
          medio_dias: ajuste.medioDias,
          motivo: ajuste.motivo,
          fecha: hoy,
          actor_id: actor.id,
        })
        .select()
        .single()
      if (error) return { ok: false, error: mensajeDeError(error) }
      await auditar('ajustó saldo', 'ajuste', creado.id,
        `${ajuste.medioDias > 0 ? '+' : ''}${formatearDias(Math.abs(ajuste.medioDias))} a ${empleado?.nombre ?? ajuste.empleadoId} — ${ajuste.motivo}`)
      await cargarDatos()
      return { ok: true }
    }

    const guardarEmpleado = async (empleado: Empleado, esNuevo: boolean): Promise<Resultado> => {
      const fila = {
        nombre: empleado.nombre,
        email: empleado.email.trim().toLowerCase(),
        pais: empleado.pais,
        puesto: empleado.puesto,
        fecha_ingreso: empleado.fechaIngreso,
        manager_id: empleado.managerId,
        rol: empleado.rol,
        activo: empleado.activo,
        avatar_color: empleado.avatarColor,
      }
      const consulta = esNuevo
        ? supabase.from('empleados').insert(fila).select().single()
        : supabase.from('empleados').update(fila).eq('id', empleado.id).select().single()
      const { data: guardado, error } = await consulta
      if (error) return { ok: false, error: mensajeDeError(error) }
      await auditar(esNuevo ? 'creó empleado' : 'editó empleado', 'empleado', guardado.id,
        `${empleado.nombre} (${empleado.email}) — rol ${empleado.rol}${empleado.activo ? '' : ', inactivo'}`)
      await cargarDatos()
      return { ok: true }
    }

    const guardarTipoAusencia = async (tipo: TipoAusencia, esNuevo: boolean): Promise<Resultado> => {
      const fila = {
        id: tipo.id,
        nombre: tipo.nombre,
        descuenta_saldo: tipo.descuentaSaldo,
        afecta_nomina: tipo.afectaNomina,
        requiere_adjunto: tipo.requiereAdjunto,
        tope_anual_dias: tipo.topeAnualDias ?? null,
        color: tipo.color,
        icono: tipo.icono,
      }
      const consulta = esNuevo
        ? supabase.from('tipos_ausencia').insert(fila)
        : supabase.from('tipos_ausencia').update(fila).eq('id', tipo.id)
      const { error } = await consulta
      if (error) return { ok: false, error: mensajeDeError(error) }
      await auditar(esNuevo ? 'creó tipo' : 'editó tipo', 'tipo_ausencia', tipo.id, tipo.nombre)
      await cargarDatos()
      return { ok: true }
    }

    const agregarFeriado = async (feriado: Omit<Feriado, 'id'>): Promise<Resultado> => {
      if (!feriado.fecha) return { ok: false, error: 'Indica la fecha del feriado.' }
      if (!feriado.descripcion.trim()) return { ok: false, error: 'Indica el nombre del feriado.' }
      const { data: creado, error } = await supabase
        .from('feriados')
        .insert({
          pais: feriado.pais,
          fecha: feriado.fecha,
          descripcion: feriado.descripcion.trim(),
          medio_dia: feriado.medioDia,
        })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return { ok: false, error: 'Ya existe un feriado en esa fecha para este país.' }
        return { ok: false, error: mensajeDeError(error) }
      }
      const pais = datos.paises.find((p) => p.codigo === feriado.pais)
      await auditar('agregó feriado', 'feriado', creado.id,
        `${pais?.nombre ?? feriado.pais}: ${formatearCorto(feriado.fecha)}${feriado.medioDia ? ' (medio día)' : ''} — ${feriado.descripcion.trim()}`)
      await cargarDatos()
      return { ok: true }
    }

    const eliminarFeriado = async (id: string): Promise<Resultado> => {
      const feriado = datos.feriados.find((f) => f.id === id)
      if (!feriado) return { ok: false, error: 'Feriado no encontrado.' }
      const { error } = await supabase.from('feriados').delete().eq('id', id)
      if (error) return { ok: false, error: mensajeDeError(error) }
      const pais = datos.paises.find((p) => p.codigo === feriado.pais)
      await auditar('eliminó feriado', 'feriado', id,
        `${pais?.nombre ?? feriado.pais}: ${formatearCorto(feriado.fecha)} — ${feriado.descripcion}`)
      await cargarDatos()
      return { ok: true }
    }

    const marcarLeidas = async () => {
      const actor = yo()
      if (!actor) return
      await supabase.from('notificaciones').update({ leida: true }).eq('para_id', actor.id).eq('leida', false)
      await cargarDatos()
    }

    return {
      sesion, datos, hoy, cargandoDatos,
      paisDe, politicaDe, aprobadorDe, saldoDe, equipoDe, pendientesDe,
      entrarConCorreo, entrarConCodigo, cerrarSesion, recargar: cargarDatos,
      crearSolicitud, resolverSolicitud, cancelarSolicitud, crearAjuste,
      guardarEmpleado, guardarTipoAusencia, agregarFeriado, eliminarFeriado,
      marcarLeidas,
    }
  }, [sesion, datos, hoy, cargarDatos])

  return <StoreContext.Provider value={valor}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValor {
  const contexto = useContext(StoreContext)
  if (!contexto) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return contexto
}
