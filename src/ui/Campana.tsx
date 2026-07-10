// Campana de notificaciones dentro de la app (canal confirmado: correo + app).

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'

export function Campana({ personaId }: { personaId: string }) {
  const { datos, marcarLeidas } = useStore()
  const [abierto, setAbierto] = useState(false)
  const referencia = useRef<HTMLDivElement>(null)

  const mias = datos.notificaciones
    .filter((n) => n.paraId === personaId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const sinLeer = mias.filter((n) => !n.leida).length

  useEffect(() => {
    if (!abierto) return
    const alClicFuera = (e: MouseEvent) => {
      if (referencia.current && !referencia.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  const alternar = () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente && sinLeer > 0) marcarLeidas(personaId)
  }

  return (
    <div className="campana-envoltorio" ref={referencia}>
      <button className="campana-boton" onClick={alternar} aria-label={`Notificaciones${sinLeer ? `, ${sinLeer} sin leer` : ''}`} aria-expanded={abierto}>
        🔔
        {sinLeer > 0 && <span className="campana-contador">{sinLeer}</span>}
      </button>
      {abierto && (
        <div className="campana-panel" role="region" aria-label="Notificaciones">
          {mias.length === 0 ? (
            <p className="campana-item" style={{ color: 'var(--muted)' }}>Sin notificaciones por ahora.</p>
          ) : (
            mias.slice(0, 12).map((n) => (
              <div key={n.id} className={`campana-item${n.leida ? '' : ' sin-leer'}`}>
                <p>{n.mensaje}</p>
                <p className="meta" style={{ marginTop: 2 }}>
                  {new Date(n.timestamp).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
