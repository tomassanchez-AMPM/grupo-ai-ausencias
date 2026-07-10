// Vista Jefe (sección 7): bandeja de aprobaciones, calendario del equipo,
// saldos del equipo. Por diseño NO existe pantalla de compensación aquí
// (sección 3.1: el Jefe no ve salarios).

import { useMemo, useState } from 'react'
import { formatearDias } from '../domain/conteoDias'
import { cadaDia, formatearISO, parseFecha } from '../domain/fechas'
import type { Empleado, SolicitudAusencia } from '../domain/types'
import { useStore } from '../state/store'
import { Avatar, EstadoVacio, textoPeriodo } from './comunes'

function TarjetaAprobacion({ solicitud }: { solicitud: SolicitudAusencia }) {
  const { datos, resolverSolicitud, saldoDe } = useStore()
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [resolviendo, setResolviendo] = useState(false)
  const empleado = datos.empleados.find((e) => e.id === solicitud.empleadoId)
  const tipo = datos.tiposAusencia.find((t) => t.id === solicitud.tipoAusenciaId)
  if (!empleado || !tipo) return null

  const resolver = async (decision: 'aprobada' | 'rechazada') => {
    if (resolviendo) return
    setResolviendo(true)
    setError('')
    const resultado = await resolverSolicitud(solicitud.id, decision, comentario.trim() || undefined)
    setResolviendo(false)
    if (!resultado.ok) setError(resultado.error)
  }

  const saldo = tipo.descuentaSaldo ? saldoDe(empleado, tipo.id) : undefined
  const rango = textoPeriodo(solicitud)

  return (
    <div className="tarjeta">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar empleado={empleado} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{empleado.nombre}</strong>
            <span className="meta">{new Date(solicitud.creadaEn).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' })}</span>
          </div>
          <p style={{ fontSize: 14.5, marginTop: 2 }}>
            {tipo.icono} {tipo.nombre} · <strong>{rango}</strong> · {formatearDias(solicitud.medioDias)}
          </p>
          {solicitud.comentarioEmpleado && (
            <p className="meta" style={{ marginTop: 4, fontStyle: 'italic' }}>“{solicitud.comentarioEmpleado}”</p>
          )}
          {solicitud.adjuntoNombre && <p className="meta" style={{ marginTop: 2 }}>📎 {solicitud.adjuntoNombre}</p>}
          {saldo && (
            <p className="meta" style={{ marginTop: 4 }}>
              Saldo del empleado tras aprobar: {formatearDias(Math.max(saldo.disponibleMedios - solicitud.medioDias, 0))}
            </p>
          )}
          <div className="campo" style={{ marginTop: 10, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Comentario para el empleado (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              aria-label="Comentario para el empleado"
            />
          </div>
          {error && <p className="error-inline" style={{ marginBottom: 10 }} role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="boton-exito" onClick={() => void resolver('aprobada')} disabled={resolviendo}>
              ✓ Aprobar
            </button>
            <button className="boton-peligro" onClick={() => void resolver('rechazada')} disabled={resolviendo}>
              ✕ Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

export function CalendarioEquipo({ miembros }: { miembros: Empleado[] }) {
  const { datos, hoy } = useStore()
  const hoyDate = parseFecha(hoy)
  const [anio, setAnio] = useState(hoyDate.getFullYear())
  const [mes, setMes] = useState(hoyDate.getMonth()) // 0-index

  const idsMiembros = useMemo(() => new Set(miembros.map((m) => m.id)), [miembros])
  const paisesEquipo = useMemo(() => new Set(miembros.map((m) => m.pais)), [miembros])

  // Ausencias aprobadas o pendientes del equipo, expandidas por día.
  const ausenciasPorDia = useMemo(() => {
    const mapa = new Map<string, { empleado: Empleado; color: string; pendiente: boolean }[]>()
    for (const s of datos.solicitudes) {
      if (!idsMiembros.has(s.empleadoId)) continue
      if (s.estado !== 'aprobada' && s.estado !== 'pendiente') continue
      const empleado = miembros.find((m) => m.id === s.empleadoId)
      const tipo = datos.tiposAusencia.find((t) => t.id === s.tipoAusenciaId)
      if (!empleado || !tipo) continue
      for (const dia of cadaDia(s.fechaInicio, s.fechaFin)) {
        if (!mapa.has(dia)) mapa.set(dia, [])
        mapa.get(dia)!.push({ empleado, color: tipo.color, pendiente: s.estado === 'pendiente' })
      }
    }
    return mapa
  }, [datos.solicitudes, datos.tiposAusencia, idsMiembros, miembros])

  const feriadosDelMes = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const f of datos.feriados) {
      if (paisesEquipo.has(f.pais)) mapa.set(f.fecha, f.descripcion)
    }
    return mapa
  }, [datos.feriados, paisesEquipo])

  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  // Lunes como primer día de la semana
  const desplazamiento = (primerDia.getDay() + 6) % 7
  const celdas: (Date | null)[] = [
    ...Array.from({ length: desplazamiento }, () => null),
    ...Array.from({ length: ultimoDia.getDate() }, (_, i) => new Date(anio, mes, i + 1)),
  ]

  const cambiarMes = (delta: number) => {
    const nueva = new Date(anio, mes + delta, 1)
    setAnio(nueva.getFullYear())
    setMes(nueva.getMonth())
  }

  return (
    <div className="tarjeta">
      <div className="calendario-cabecera">
        <button className="boton-secundario" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">←</button>
        <h3 style={{ textTransform: 'capitalize' }}>{MESES[mes]} {anio}</h3>
        <button className="boton-secundario" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">→</button>
      </div>
      <div className="calendario-grilla" role="grid" aria-label={`Calendario del equipo, ${MESES[mes]} ${anio}`}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="calendario-dia-nombre">{d}</div>
        ))}
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`v-${i}`} className="calendario-celda fuera" aria-hidden="true" />
          const iso = formatearISO(fecha)
          const ausencias = ausenciasPorDia.get(iso) ?? []
          const feriado = feriadosDelMes.get(iso)
          const esHoy = iso === hoy
          return (
            <div key={iso} className={`calendario-celda${esHoy ? ' hoy' : ''}${feriado ? ' feriado' : ''}`} role="gridcell">
              <span className="calendario-num">{fecha.getDate()}</span>
              {feriado && <span className="pastilla-ausencia" style={{ background: 'var(--aviso)' }} title={feriado}>🎉 {feriado}</span>}
              {ausencias.slice(0, 3).map((a, j) => (
                <span
                  key={j}
                  className="pastilla-ausencia"
                  style={{ background: a.color, opacity: a.pendiente ? 0.55 : 1 }}
                  title={`${a.empleado.nombre}${a.pendiente ? ' (pendiente)' : ''}`}
                >
                  {a.empleado.nombre.split(' ')[0]}
                </span>
              ))}
              {ausencias.length > 3 && <span className="meta">+{ausencias.length - 3}</span>}
            </div>
          )
        })}
      </div>
      <div className="leyenda">
        {datos.tiposAusencia.map((t) => (
          <span key={t.id}><span className="punto" style={{ background: t.color }} />{t.nombre}</span>
        ))}
        <span><span className="punto" style={{ background: 'var(--aviso)' }} />Feriado</span>
        <span style={{ opacity: 0.55 }}>Tono tenue = pendiente</span>
      </div>
    </div>
  )
}

export function JefeView({ jefe }: { jefe: Empleado }) {
  const { datos, equipoDe, pendientesDe, saldoDe, paisDe } = useStore()
  const equipo = equipoDe(jefe.id)
  const pendientes = pendientesDe(jefe.id)
  const tiposConSaldo = datos.tiposAusencia.filter((t) => t.descuentaSaldo)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Avatar empleado={jefe} grande />
        <div>
          <h1>Equipo de {jefe.nombre.split(' ')[0]}</h1>
          <p className="meta">{equipo.length} persona{equipo.length === 1 ? '' : 's'} a cargo · {pendientes.length} solicitud{pendientes.length === 1 ? '' : 'es'} por resolver</p>
        </div>
      </div>

      <section aria-label="Bandeja de aprobaciones" style={{ marginBottom: 28 }}>
        <div className="encabezado-seccion">
          <h2>Bandeja de aprobaciones</h2>
          {pendientes.length > 0 && <span className="insignia pendiente">{pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}</span>}
        </div>
        {pendientes.length === 0 ? (
          <EstadoVacio emoji="✅" mensaje="Todo al día" sugerencia="No hay solicitudes esperando tu decisión." />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {pendientes.map((s) => <TarjetaAprobacion key={s.id} solicitud={s} />)}
          </div>
        )}
      </section>

      <section aria-label="Calendario del equipo" style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 12 }}>Calendario del equipo</h2>
        {equipo.length === 0 ? (
          <EstadoVacio emoji="👥" mensaje="No tienes personas a cargo" sugerencia="El administrador puede asignarte empleados." />
        ) : (
          <CalendarioEquipo miembros={equipo} />
        )}
      </section>

      {equipo.length > 0 && (
        <section aria-label="Saldos del equipo">
          <h2 style={{ marginBottom: 12 }}>Saldos del equipo</h2>
          <div className="contenedor-tabla">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>País</th>
                  {tiposConSaldo.map((t) => <th key={t.id}>{t.nombre}</th>)}
                  <th>En trámite</th>
                </tr>
              </thead>
              <tbody>
                {equipo.map((miembro) => {
                  const pais = paisDe(miembro)
                  return (
                    <tr key={miembro.id}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar empleado={miembro} /> {miembro.nombre}
                        </span>
                      </td>
                      <td>{pais?.bandera} {pais?.nombre}</td>
                      {tiposConSaldo.map((t) => {
                        const saldo = saldoDe(miembro, t.id)
                        return (
                          <td key={t.id}>
                            {saldo ? <strong>{formatearDias(Math.max(saldo.disponibleMedios, 0))}</strong> : <span className="meta">sin política</span>}
                          </td>
                        )
                      })}
                      <td>
                        {(() => {
                          const enTramite = datos.solicitudes
                            .filter((s) => s.empleadoId === miembro.id && s.estado === 'pendiente')
                            .reduce((total, s) => total + s.medioDias, 0)
                          return enTramite > 0 ? formatearDias(enTramite) : <span className="meta">—</span>
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
