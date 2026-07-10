// Vista Empleado — mobile-first (sección 7): Mi saldo, Solicitar,
// Mis solicitudes, historial. (El módulo Compensación está apagado por ahora.)

import { useState } from 'react'
import { formatearDias } from '../domain/conteoDias'
import type { Empleado, SolicitudAusencia } from '../domain/types'
import { useStore } from '../state/store'
import { Avatar, EstadoVacio, IconoTipo, InsigniaEstado, textoPeriodo } from './comunes'
import { SolicitudForm } from './SolicitudForm'

function ItemSolicitud({ solicitud, propia }: { solicitud: SolicitudAusencia; propia?: boolean }) {
  const { datos, cancelarSolicitud } = useStore()
  const tipo = datos.tiposAusencia.find((t) => t.id === solicitud.tipoAusenciaId)
  if (!tipo) return null
  const rango = textoPeriodo(solicitud)

  return (
    <div className="item-solicitud">
      <IconoTipo tipo={tipo} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14.5 }}>{tipo.nombre}</strong>
          <InsigniaEstado estado={solicitud.estado} />
        </div>
        <p className="meta">
          {rango} · {formatearDias(solicitud.medioDias)}
          {solicitud.adjuntoNombre && <> · 📎 {solicitud.adjuntoNombre}</>}
        </p>
        {solicitud.comentarioAprobador && (
          <p className="meta" style={{ marginTop: 4, fontStyle: 'italic' }}>
            “{solicitud.comentarioAprobador}”
          </p>
        )}
        {propia && solicitud.estado === 'pendiente' && (
          <button
            className="boton-fantasma"
            style={{ marginTop: 6, padding: '4px 8px', minHeight: 32 }}
            onClick={() => {
              if (!window.confirm('¿Cancelar esta solicitud?')) return
              void cancelarSolicitud(solicitud.id).then((r) => {
                if (!r.ok) window.alert(r.error)
              })
            }}
          >
            Cancelar solicitud
          </button>
        )}
      </div>
    </div>
  )
}

export function EmpleadoView({ empleado }: { empleado: Empleado }) {
  const { datos, paisDe, saldoDe, politicaDe } = useStore()
  const [formAbierto, setFormAbierto] = useState(false)
  const pais = paisDe(empleado)

  const misSolicitudes = datos.solicitudes
    .filter((s) => s.empleadoId === empleado.id)
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  const activas = misSolicitudes.filter((s) => s.estado === 'pendiente' || s.estado === 'aprobada')
  const historial = misSolicitudes.filter((s) => s.estado === 'rechazada' || s.estado === 'cancelada')

  const tiposConSaldo = datos.tiposAusencia.filter((t) => t.descuentaSaldo && politicaDe(empleado, t.id))

  return (
    <div className="vista-empleado">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Avatar empleado={empleado} grande />
        <div>
          <h1>Hola, {empleado.nombre.split(' ')[0]} 👋</h1>
          <p className="meta">
            {empleado.puesto} · {pais?.bandera} {pais?.nombre}
          </p>
        </div>
      </div>

      {/* Mi saldo */}
      <div className="tarjetas-saldo">
        {tiposConSaldo.map((tipo) => {
          const saldo = saldoDe(empleado, tipo.id)
          const politica = politicaDe(empleado, tipo.id)
          if (!saldo || !politica) return null
          const disponibles = Math.max(saldo.disponibleMedios - saldo.pendienteMedios, 0) / 2
          const total = (saldo.disponibleMedios + saldo.usadoMedios) / 2 || 1
          return (
            <div className="tarjeta" key={tipo.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="saldo-sub" style={{ fontWeight: 650 }}>{tipo.icono} {tipo.nombre}</p>
                  <p className="saldo-numero">{Number.isInteger(disponibles) ? disponibles : disponibles.toFixed(1)}</p>
                  <p className="saldo-sub">días disponibles</p>
                </div>
              </div>
              <div className="barra-progreso" aria-hidden="true">
                <div style={{ width: `${Math.min((disponibles / total) * 100, 100)}%`, background: tipo.color }} />
              </div>
              <p className="saldo-sub" style={{ marginTop: 8 }}>
                Usados: {formatearDias(saldo.usadoMedios)}
                {saldo.pendienteMedios > 0 && <> · En trámite: {formatearDias(saldo.pendienteMedios)}</>}
                {saldo.carryoverMedios > 0 && <> · Arrastre: {formatearDias(saldo.carryoverMedios)}</>}
              </p>
            </div>
          )
        })}
      </div>

      <button className="boton-primario" style={{ width: '100%', marginTop: 16, padding: 14 }} onClick={() => setFormAbierto(true)}>
        + Solicitar ausencia
      </button>

      {/* Mis solicitudes */}
      <section className="grupo-seccion" aria-label="Mis solicitudes">
        <h2>Mis solicitudes</h2>
        {activas.length === 0 ? (
          <EstadoVacio emoji="🗓️" mensaje="No tienes solicitudes activas" sugerencia="Crea una con el botón de arriba." />
        ) : (
          activas.map((s) => <ItemSolicitud key={s.id} solicitud={s} propia />)
        )}
      </section>

      {/* Historial */}
      {historial.length > 0 && (
        <section className="grupo-seccion" aria-label="Historial">
          <h2>Historial</h2>
          {historial.map((s) => <ItemSolicitud key={s.id} solicitud={s} />)}
        </section>
      )}

      {formAbierto && <SolicitudForm empleado={empleado} onCerrar={() => setFormAbierto(false)} />}
    </div>
  )
}
