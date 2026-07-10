// Cascarón de la app con login simulado: el probador elige con qué usuario
// entrar y la app muestra solo lo que ese rol permite (sección 3 del diseño).
// La "sesión" vive en sessionStorage: cada pestaña del navegador puede ser un
// usuario distinto, compartiendo los mismos datos — ideal para probar el
// flujo solicitud → aprobación en paralelo.

import { useEffect, useState } from 'react'
import type { Empleado } from './domain/types'
import { StoreProvider, useStore } from './state/store'
import { AdminView } from './ui/AdminView'
import { Campana } from './ui/Campana'
import { Avatar } from './ui/comunes'
import { EmpleadoView } from './ui/EmpleadoView'
import { JefeView } from './ui/JefeView'

const CLAVE_SESION = 'rrhh-sesion'

function leerSesion(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_SESION)
  } catch {
    return null
  }
}

function guardarSesion(personaId: string | null) {
  try {
    if (personaId) sessionStorage.setItem(CLAVE_SESION, personaId)
    else sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // Entorno sin almacenamiento: la sesión vive solo en memoria.
  }
}

const NOMBRE_ROL: Record<Empleado['rol'], string> = {
  empleado: 'Empleado',
  jefe: 'Jefe',
  admin: 'Admin / RRHH',
}

function PantallaLogin({ onEntrar }: { onEntrar: (personaId: string) => void }) {
  const { datos, paisDe, restablecer } = useStore()
  const activos = datos.empleados.filter((e) => e.activo)

  return (
    <div className="login-envoltorio">
      <div className="marca" style={{ justifyContent: 'center', marginBottom: 6 }}>
        <span className="marca-logo" aria-hidden="true">🌴</span>
        <span>Ausencias</span>
      </div>
      <h1 style={{ textAlign: 'center' }}>¿Quién eres?</h1>
      <p className="meta" style={{ textAlign: 'center', maxWidth: 440, margin: '6px auto 26px' }}>
        Prototipo de prueba: elige un usuario para entrar con su rol. En la versión real
        esto será el inicio de sesión con tu correo.
      </p>
      <div className="login-grid">
        {activos.map((e) => {
          const pais = paisDe(e)
          return (
            <button key={e.id} className="login-card" onClick={() => onEntrar(e.id)}>
              <Avatar empleado={e} grande />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: 'var(--titulo)' }}>{e.nombre}</strong>
                <span className="meta">{e.puesto} · {pais.bandera}</span>
              </span>
              <span className={`insignia ${e.rol === 'admin' ? 'primaria' : 'neutra'}`}>
                {NOMBRE_ROL[e.rol]}
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ textAlign: 'center', marginTop: 26 }}>
        <button className="boton-fantasma" onClick={restablecer} title="Vuelve a los datos de ejemplo originales">
          ↺ Restablecer datos de ejemplo
        </button>
      </p>
    </div>
  )
}

type Vista = 'yo' | 'equipo' | 'admin'

function Sesion({ persona, onSalir }: { persona: Empleado; onSalir: () => void }) {
  const [vista, setVista] = useState<Vista>('yo')

  useEffect(() => setVista('yo'), [persona.id])

  const vistas: { id: Vista; nombre: string }[] = [{ id: 'yo', nombre: 'Mi espacio' }]
  if (persona.rol !== 'empleado') vistas.push({ id: 'equipo', nombre: 'Mi equipo' })
  if (persona.rol === 'admin') vistas.push({ id: 'admin', nombre: 'Administración' })

  return (
    <div className="app-shell">
      <header className="barra-superior">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">🌴</span>
          <span>
            Ausencias
            <small>Prototipo · Grupo multipaís</small>
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
          <span className="chip-persona" title={`${persona.puesto} — sesión de prueba`}>
            <Avatar empleado={persona} />
            <span className="chip-persona-nombre">{persona.nombre.split(' ')[0]}</span>
          </span>
          <Campana personaId={persona.id} />
          <button className="boton-fantasma" onClick={onSalir}>Cambiar usuario</button>
        </div>
      </header>

      <main>
        {vista === 'yo' && <EmpleadoView empleado={persona} />}
        {vista === 'equipo' && <JefeView jefe={persona} />}
        {vista === 'admin' && <AdminView admin={persona} />}
      </main>
    </div>
  )
}

function Shell() {
  const { datos } = useStore()
  const [personaId, setPersonaId] = useState<string | null>(leerSesion)

  const persona = datos.empleados.find((e) => e.id === personaId && e.activo)

  if (!persona) {
    return (
      <PantallaLogin
        onEntrar={(id) => {
          guardarSesion(id)
          setPersonaId(id)
        }}
      />
    )
  }

  return (
    <Sesion
      persona={persona}
      onSalir={() => {
        guardarSesion(null)
        setPersonaId(null)
      }}
    />
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
