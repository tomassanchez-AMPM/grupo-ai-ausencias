// Bandeja de solicitudes de cambio: quien tiene nivel de aprobación compara
// «vigente → propuesto» y resuelve. El doble control lo impone la base; aquí
// solo se ocultan los botones que de todos modos serían rechazados.

import { useEffect, useState } from 'react'
import { EstadoVacio } from '../ui/comunes'
import { api, mensajeDe } from './api'
import { ResumenSeccion, fecha } from './Resumen'
import {
  NOMBRE_TIPO,
  type Catalogos, type NivelPlanilla, type PayloadAlta, type Seccion, type Solicitud,
} from './tipos'

const ESTADO: Record<Solicitud['estado'], string> = {
  pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada',
}
const SECCIONES_ALTA: Seccion[] = ['general', 'compensacion', 'pagadores', 'clases', 'cuenta', 'deducciones']

function Tarjeta({
  solicitud, catalogos, niveles, yo, onResuelta,
}: {
  solicitud: Solicitud
  catalogos: Catalogos
  niveles: NivelPlanilla[]
  yo: string | null
  onResuelta: () => void
}) {
  const [comentario, setComentario] = useState('')
  const [numero, setNumero] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const pendiente = solicitud.estado === 'pendiente'
  const esMia = solicitud.propuesta_por_id === yo
  const sobreMiFicha = solicitud.empleado_id === yo
  const puedeResolver = pendiente && niveles.includes('aprobacion') && !esMia && !sobreMiFicha

  const ejecutar = async (accion: () => Promise<unknown>) => {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      await accion()
      onResuelta()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  const verCuenta = async () => {
    setError('')
    try {
      setNumero(await api.revelarCuenta({ solicitudId: solicitud.id }, 'Verificación de la cuenta propuesta antes de resolver'))
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  const alta = solicitud.tipo === 'alta' ? (solicitud.payload as PayloadAlta) : null

  return (
    <div className="tarjeta">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>{solicitud.empleado} · {NOMBRE_TIPO[solicitud.tipo]}</strong>
        <span className={`insignia ${solicitud.estado}`}>{ESTADO[solicitud.estado]}</span>
      </div>
      <p className="meta" style={{ marginTop: 2 }}>
        Propuesta por {solicitud.propuesta_por} el {fecha(solicitud.propuesta_en)} · vigente desde <strong>{fecha(solicitud.vigente_desde)}</strong>
      </p>
      <p style={{ fontSize: 14, margin: '6px 0 10px', fontStyle: 'italic' }}>«{solicitud.motivo}»</p>

      {alta ? (
        SECCIONES_ALTA.filter((s) => alta[s] != null).map((s) => (
          <div key={s} style={{ marginBottom: 8 }}>
            <span className="meta" style={{ display: 'block', fontWeight: 600 }}>{NOMBRE_TIPO[s]}</span>
            <ResumenSeccion seccion={s} datos={alta[s]} catalogos={catalogos} />
          </div>
        ))
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {pendiente && (
            <div>
              <span className="meta" style={{ display: 'block', fontWeight: 600 }}>Vigente hoy</span>
              <ResumenSeccion seccion={solicitud.tipo as Seccion} datos={solicitud.actual} catalogos={catalogos} />
            </div>
          )}
          <div>
            <span className="meta" style={{ display: 'block', fontWeight: 600 }}>Propuesto</span>
            <ResumenSeccion seccion={solicitud.tipo as Seccion} datos={solicitud.payload} catalogos={catalogos} />
          </div>
        </div>
      )}

      {pendiente && solicitud.trae_cuenta && niveles.includes('aprobacion') && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {numero
            ? <>Número de cuenta propuesto: <strong style={{ letterSpacing: '0.08em' }}>{numero}</strong></>
            : <button className="boton-fantasma" style={{ padding: '2px 8px', minHeight: 28 }} onClick={() => void verCuenta()}>Ver el número de cuenta propuesto (queda registrado)</button>}
        </p>
      )}

      {!pendiente && solicitud.resuelta_por && (
        <p className="meta" style={{ marginTop: 8 }}>
          {ESTADO[solicitud.estado]} por {solicitud.resuelta_por} el {fecha(solicitud.resuelta_en)}
          {solicitud.comentario_resolucion && <> — «{solicitud.comentario_resolucion}»</>}
        </p>
      )}

      {pendiente && niveles.includes('aprobacion') && esMia && (
        <p className="meta" style={{ marginTop: 8 }}>Doble control: tú la propusiste, debe resolverla otra persona con nivel de aprobación.</p>
      )}
      {pendiente && niveles.includes('aprobacion') && sobreMiFicha && !esMia && (
        <p className="meta" style={{ marginTop: 8 }}>Doble control: es un cambio sobre tu propia ficha, debe resolverlo otro aprobador.</p>
      )}

      {error && <p className="error-inline" style={{ marginTop: 8 }} role="alert">{error}</p>}

      {puedeResolver && (
        <>
          <div className="campo" style={{ marginTop: 10, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Comentario (obligatorio si rechazas)"
              aria-label="Comentario de la resolución"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="boton-exito" disabled={ocupado} onClick={() => void ejecutar(() => api.resolverSolicitud(solicitud.id, true, comentario.trim() || undefined))}>
              ✓ Aprobar
            </button>
            <button className="boton-peligro" disabled={ocupado || !comentario.trim()} onClick={() => void ejecutar(() => api.resolverSolicitud(solicitud.id, false, comentario.trim()))}>
              ✕ Rechazar
            </button>
          </div>
        </>
      )}
      {pendiente && esMia && (
        <button
          className="boton-fantasma"
          style={{ marginTop: 8 }}
          disabled={ocupado}
          onClick={() => { if (window.confirm('¿Cancelar esta solicitud?')) void ejecutar(() => api.cancelarSolicitud(solicitud.id)) }}
        >
          Cancelar mi solicitud
        </button>
      )}
    </div>
  )
}

export function Solicitudes({
  catalogos, niveles, yo, onCambio,
}: {
  catalogos: Catalogos
  niveles: NivelPlanilla[]
  yo: string | null
  onCambio: () => void
}) {
  const [filtro, setFiltro] = useState<'pendiente' | 'todas'>('pendiente')
  const [lista, setLista] = useState<Solicitud[] | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    api.solicitudes(filtro)
      .then((datos) => { if (vigente) { setLista(datos); setError('') } })
      .catch((e: unknown) => { if (vigente) setError(mensajeDe(e)) })
    return () => { vigente = false }
  }, [filtro, version])

  const alResolver = () => {
    setVersion((v) => v + 1)
    onCambio()
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h2>Solicitudes de cambio</h2>
        <div className="segmento" role="tablist" aria-label="Filtro de solicitudes" style={{ maxWidth: 260 }}>
          <button className={filtro === 'pendiente' ? 'activo' : ''} onClick={() => setFiltro('pendiente')} role="tab" aria-selected={filtro === 'pendiente'}>Pendientes</button>
          <button className={filtro === 'todas' ? 'activo' : ''} onClick={() => setFiltro('todas')} role="tab" aria-selected={filtro === 'todas'}>Todas</button>
        </div>
      </div>
      {error && <p className="error-inline" role="alert">{error}</p>}
      {lista === null && !error ? <p className="meta">Cargando…</p> : null}
      {lista && lista.length === 0 && (
        <EstadoVacio emoji="✅" mensaje={filtro === 'pendiente' ? 'No hay cambios esperando aprobación' : 'Aún no hay solicitudes'} />
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {lista?.map((s) => (
          <Tarjeta key={s.id} solicitud={s} catalogos={catalogos} niveles={niveles} yo={yo} onResuelta={alResolver} />
        ))}
      </div>
    </>
  )
}
