// Cascarón de la app con autenticación real (Supabase, enlace mágico).
// Cada usuario ve solo las secciones que su rol permite (sección 3 del
// documento de diseño); la base de datos aplica la misma regla vía RLS.

import { Suspense, lazy, useEffect, useState } from 'react'
import type { Empleado } from './domain/types'
import { supabase } from './lib/supabase'
import type { AccesoPlanilla, NivelPlanilla } from './planilla/tipos'
import { StoreProvider, useStore } from './state/store'
import { AdminView } from './ui/AdminView'
import { Campana } from './ui/Campana'
import { Avatar } from './ui/comunes'
import { EmpleadoView } from './ui/EmpleadoView'
import { JefeView } from './ui/JefeView'
import { LoginView } from './ui/LoginView'
import { LogoPausa } from './ui/LogoPausa'

// Planilla se descarga solo cuando alguien con permiso la abre.
const PlanillaView = lazy(() => import('./planilla/PlanillaView'))

type Vista = 'yo' | 'equipo' | 'admin' | 'planilla'

function Sesion({ persona }: { persona: Empleado }) {
  const { cerrarSesion } = useStore()
  const [vista, setVista] = useState<Vista>('yo')
  const [nivelesPlanilla, setNivelesPlanilla] = useState<NivelPlanilla[]>([])

  useEffect(() => setVista('yo'), [persona.id])

  // Solo pregunta si la persona tiene permiso de planilla (para mostrar la
  // sección). Los datos exigen además segundo factor, y eso lo impone la base.
  useEffect(() => {
    let vigente = true
    void supabase.rpc('pla_mi_acceso').then(({ data }) => {
      const acceso = data as AccesoPlanilla | null
      if (vigente) setNivelesPlanilla(acceso?.tiene_acceso ? acceso.niveles : [])
    })
    return () => { vigente = false }
  }, [persona.id])

  const vistas: { id: Vista; nombre: string }[] = [{ id: 'yo', nombre: 'Mi espacio' }]
  if (persona.rol !== 'empleado') vistas.push({ id: 'equipo', nombre: 'Mi equipo' })
  if (persona.rol === 'admin' || persona.rol === 'gestor')
    vistas.push({ id: 'admin', nombre: persona.rol === 'admin' ? 'Administración' : 'Mi empresa' })
  if (nivelesPlanilla.length > 0) vistas.push({ id: 'planilla', nombre: 'Planilla' })

  return (
    <div className="app-shell">
      <header className="barra-superior">
        <div className="marca">
          <span className="marca-logo">
            <LogoPausa tamano={38} />
          </span>
          <span>
            Pausa
            <small>Pedir. Aprobar. Desconectar.</small>
          </span>
        </div>
        <div className="barra-derecha">
          {vistas.length > 1 && (
            <nav className="selector-rol" aria-label="Secciones disponibles para tu rol">
              {vistas.map((v) => (
                <button key={v.id} className={vista === v.id ? 'activo' : ''} onClick={() => setVista(v.id)} aria-pressed={vista === v.id}>
                  {v.nombre}
                </button>
              ))}
            </nav>
          )}
          <span className="chip-persona" title={persona.puesto}>
            <Avatar empleado={persona} />
            <span className="chip-persona-nombre">{persona.nombre.split(' ')[0]}</span>
          </span>
          <Campana personaId={persona.id} />
          <button className="boton-fantasma" onClick={() => void cerrarSesion()}>Cerrar sesión</button>
        </div>
      </header>

      <main>
        {vista === 'yo' && <EmpleadoView empleado={persona} />}
        {vista === 'equipo' && <JefeView jefe={persona} />}
        {vista === 'admin' && <AdminView admin={persona} />}
        {vista === 'planilla' && nivelesPlanilla.length > 0 && (
          <Suspense fallback={<p className="meta">Cargando Planilla…</p>}>
            <PlanillaView persona={persona} niveles={nivelesPlanilla} />
          </Suspense>
        )}
      </main>
    </div>
  )
}

function PantallaCentrada({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-envoltorio" style={{ maxWidth: 460 }}>
      <div className="tarjeta" style={{ textAlign: 'center' }}>{children}</div>
    </div>
  )
}

function Shell() {
  const { sesion, cerrarSesion } = useStore()

  switch (sesion.fase) {
    case 'cargando':
      return (
        <PantallaCentrada>
          <p style={{ fontSize: 34 }} aria-hidden="true">🌴</p>
          <p className="meta">Cargando…</p>
        </PantallaCentrada>
      )
    case 'anonimo':
      return <LoginView />
    case 'sin_registro':
      return (
        <PantallaCentrada>
          <p style={{ fontSize: 34 }} aria-hidden="true">🔒</p>
          <h1>Tu correo no está registrado</h1>
          <p className="meta" style={{ marginTop: 8 }}>
            Iniciaste sesión como <strong style={{ color: 'var(--titulo)' }}>{sesion.email}</strong>,
            pero ese correo no corresponde a ningún empleado activo.
            Pide al administrador de RRHH que te agregue con este correo exacto.
          </p>
          <button className="boton-secundario" style={{ marginTop: 14 }} onClick={() => void cerrarSesion()}>
            Salir e intentar con otro correo
          </button>
        </PantallaCentrada>
      )
    case 'activa':
      return <Sesion persona={sesion.empleado} />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
