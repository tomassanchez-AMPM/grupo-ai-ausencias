// Primitivas de UI compartidas — consistencia entre las tres vistas.

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { reintegroDe } from '../domain/conteoDias'
import { formatearCorto } from '../domain/fechas'
import type { Empleado, EstadoSolicitud, SolicitudAusencia, TipoAusencia } from '../domain/types'

/** Texto uniforme del período de una solicitud: "6 abr · reintegro 13 abr". */
export function textoPeriodo(solicitud: SolicitudAusencia): string {
  const reintegro = reintegroDe(solicitud)
  const inicio = formatearCorto(solicitud.fechaInicio)
  if (solicitud.fechaInicio === solicitud.fechaFin && solicitud.fraccionInicio !== 'completo') {
    return `${inicio} (${solicitud.fraccionInicio === 'manana' ? 'mañana' : 'tarde'})`
  }
  return `${inicio} · reintegro ${formatearCorto(reintegro.fecha)}${reintegro.mediodia ? ' (mediodía)' : ''}`
}

export function Avatar({ empleado, grande }: { empleado: Empleado; grande?: boolean }) {
  const iniciales = empleado.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
  return (
    <span
      className={`avatar${grande ? ' grande' : ''}`}
      style={{ background: empleado.avatarColor }}
      aria-hidden="true"
    >
      {iniciales}
    </span>
  )
}

const TEXTO_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: '⏳ Pendiente',
  aprobada: '✓ Aprobada',
  rechazada: '✕ Rechazada',
  cancelada: '– Cancelada',
}

export function InsigniaEstado({ estado }: { estado: EstadoSolicitud }) {
  return <span className={`insignia ${estado}`}>{TEXTO_ESTADO[estado]}</span>
}

export function IconoTipo({ tipo }: { tipo: TipoAusencia }) {
  return (
    <span className="icono-tipo" style={{ background: `${tipo.color}22`, border: `1px solid ${tipo.color}44` }} aria-hidden="true">
      {tipo.icono}
    </span>
  )
}

export function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  // Cerrar solo con acción explícita (✕, Cancelar o Escape): un clic
  // accidental fuera del modal no debe descartar un formulario a medio llenar.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  return (
    <div className="modal-fondo" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="boton-fantasma" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EstadoVacio({ emoji, mensaje, sugerencia }: { emoji: string; mensaje: string; sugerencia?: string }) {
  return (
    <div className="estado-vacio">
      <span className="emoji" aria-hidden="true">{emoji}</span>
      <p style={{ fontWeight: 600 }}>{mensaje}</p>
      {sugerencia && <p style={{ fontSize: 13, marginTop: 4 }}>{sugerencia}</p>}
    </div>
  )
}
