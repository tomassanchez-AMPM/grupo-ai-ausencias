// Módulo de Planilla (Fase 1: fichas con historial y control de cambios).
// Acceso restringido: lo ve solo quien tiene permiso de planilla, y exige
// segundo factor. Se carga aparte del resto de Pausa (import dinámico) y no
// guarda nada en el store de vacaciones.

import { useCallback, useEffect, useState } from 'react'
import type { Empleado } from '../domain/types'
import { Avatar } from '../ui/comunes'
import { Bitacora, Configuracion } from './Ajustes'
import { ErrorPlanilla, api, mensajeDe } from './api'
import { Fichas } from './Fichas'
import { SegundoFactor } from './SegundoFactor'
import { Solicitudes } from './Solicitudes'
import { NOMBRE_NIVEL, type Catalogos, type Ficha, type NivelPlanilla } from './tipos'

type Pestana = 'fichas' | 'solicitudes' | 'bitacora' | 'configuracion'

export default function PlanillaView({ persona, niveles }: { persona: Empleado; niveles: NivelPlanilla[] }) {
  const [verificado, setVerificado] = useState(false)
  const [pestana, setPestana] = useState<Pestana>('fichas')
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [listaFichas, cats] = await Promise.all([api.fichas(), api.catalogos()])
      setFichas(listaFichas)
      setCatalogos(cats)
      setError('')
    } catch (e) {
      // Si la sesión perdió el segundo factor, se vuelve a pedir.
      if (e instanceof ErrorPlanilla && e.codigo === 'MFA') setVerificado(false)
      else setError(mensajeDe(e))
    }
  }, [])

  useEffect(() => {
    if (verificado) void cargar()
  }, [verificado, cargar])

  const alVerificar = useCallback(() => setVerificado(true), [])

  const pendientes = fichas?.reduce((t, f) => t + f.pendientes, 0) ?? 0
  const pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'fichas', nombre: '🗂️ Fichas' },
    { id: 'solicitudes', nombre: `✍️ Solicitudes de cambio${pendientes > 0 ? ` (${pendientes})` : ''}` },
  ]
  if (niveles.includes('aprobacion') || niveles.includes('admin')) pestanas.push({ id: 'bitacora', nombre: '📜 Bitácora' })
  if (niveles.includes('admin')) pestanas.push({ id: 'configuracion', nombre: '⚙️ Configuración' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Avatar empleado={persona} grande />
        <div>
          <h1>Planilla</h1>
          <p className="meta">
            {persona.nombre} · {niveles.map((n) => NOMBRE_NIVEL[n]).join(' + ')} · acceso restringido
          </p>
        </div>
      </div>

      {!verificado ? (
        <SegundoFactor onListo={alVerificar} />
      ) : (
        <>
          <nav className="pestanas" aria-label="Secciones de planilla">
            {pestanas.map((p) => (
              <button key={p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)} aria-current={pestana === p.id}>
                {p.nombre}
              </button>
            ))}
          </nav>
          {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
          {(!fichas || !catalogos) && !error && <p className="meta">Cargando planilla…</p>}
          {fichas && catalogos && (
            <>
              {pestana === 'fichas' && <Fichas fichas={fichas} catalogos={catalogos} niveles={niveles} onRecargar={() => void cargar()} />}
              {pestana === 'solicitudes' && <Solicitudes catalogos={catalogos} niveles={niveles} yo={persona.id} onCambio={() => void cargar()} />}
              {pestana === 'bitacora' && <Bitacora />}
              {pestana === 'configuracion' && <Configuracion catalogos={catalogos} onCambio={() => void cargar()} />}
            </>
          )}
        </>
      )}
    </div>
  )
}
