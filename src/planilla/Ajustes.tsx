// Bitácora (solo lectura) y configuración de Planilla (permisos y catálogos).

import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { EstadoVacio } from '../ui/comunes'
import { api, mensajeDe } from './api'
import { NOMBRE_NIVEL, type Catalogos, type EntradaBitacora, type NivelPlanilla, type Permiso } from './tipos'

const OPERACION: Record<string, string> = { INSERT: 'creó', UPDATE: 'modificó', DELETE: 'eliminó', REVELAR: 'vio el número de cuenta' }
const OCULTOS = new Set(['id', 'solicitud_id', 'creada_en', 'actualizada_en', 'creado_en', 'propuesta_en'])

function cambios(e: EntradaBitacora): string {
  const antes = e.antes ?? {}
  const despues = e.despues ?? {}
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter((k) => !OCULTOS.has(k))
  const texto = (v: unknown) => (v == null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  if (e.operacion === 'UPDATE') {
    return claves.filter((k) => texto(antes[k]) !== texto(despues[k])).map((k) => `${k}: ${texto(antes[k])} → ${texto(despues[k])}`).join(' · ')
  }
  const fuente = e.operacion === 'DELETE' ? antes : despues
  return claves.filter((k) => fuente[k] != null).map((k) => `${k}: ${texto(fuente[k])}`).join(' · ')
}

export function Bitacora() {
  const [entradas, setEntradas] = useState<EntradaBitacora[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    api.bitacora()
      .then((datos) => { if (vigente) setEntradas(datos) })
      .catch((e: unknown) => { if (vigente) setError(mensajeDe(e)) })
    return () => { vigente = false }
  }, [])

  return (
    <>
      <div className="encabezado-seccion"><h2>Bitácora de planilla</h2></div>
      <p className="meta" style={{ marginBottom: 12 }}>
        Registro de solo inserción generado por la base de datos: incluye los cambios hechos desde la
        interfaz y los hechos por código o SQL directo (origen «sql_directo»). Nadie puede modificarlo ni borrarlo.
      </p>
      {error && <p className="error-inline" role="alert">{error}</p>}
      {entradas === null && !error && <p className="meta">Cargando…</p>}
      {entradas && entradas.length === 0 && <EstadoVacio emoji="📜" mensaje="Sin movimientos todavía" />}
      {entradas && entradas.length > 0 && (
        <div className="contenedor-tabla">
          <table>
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.ocurrido_en).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    {e.actor}
                    <span className="meta" style={{ display: 'block' }}>{e.origen}</span>
                  </td>
                  <td>
                    {OPERACION[e.operacion] ?? e.operacion} <strong>{e.tabla}</strong>
                    {e.empleado && <span className="meta" style={{ display: 'block' }}>{e.empleado}</span>}
                  </td>
                  <td style={{ fontSize: 12.5, wordBreak: 'break-word' }}>
                    {e.motivo && <span style={{ display: 'block', fontStyle: 'italic' }}>«{e.motivo}»</span>}
                    {cambios(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function Configuracion({ catalogos, onCambio }: { catalogos: Catalogos; onCambio: () => void }) {
  const { datos } = useStore()
  const [permisos, setPermisos] = useState<Permiso[] | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [empleadoId, setEmpleadoId] = useState('')
  const [nivel, setNivel] = useState<NivelPlanilla>('consulta')
  const [clase, setClase] = useState('')
  const [banco, setBanco] = useState('')

  useEffect(() => {
    let vigente = true
    api.permisos()
      .then((lista) => { if (vigente) setPermisos(lista) })
      .catch((e: unknown) => { if (vigente) setError(mensajeDe(e)) })
    return () => { vigente = false }
  }, [version])

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError('')
    try {
      await accion()
      setVersion((v) => v + 1)
      onCambio()
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <>
      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}

      <div className="encabezado-seccion"><h2>Permisos de planilla</h2></div>
      <p className="meta" style={{ marginBottom: 12 }}>
        Son independientes de los roles de vacaciones: ser administrador de Pausa no da acceso a Planilla.
        Quien propone un cambio no puede aprobarlo, y nadie resuelve cambios sobre su propia ficha.
      </p>
      <div className="contenedor-tabla" style={{ marginBottom: 12 }}>
        <table>
          <thead><tr><th>Persona</th><th>Nivel</th><th>Alcance</th><th /></tr></thead>
          <tbody>
            {(permisos ?? []).map((p) => (
              <tr key={p.id}>
                <td><strong>{p.empleado}</strong></td>
                <td>{NOMBRE_NIVEL[p.nivel]}</td>
                <td>{p.empresa ?? 'Todas las empresas pagadoras'}</td>
                <td>
                  <button className="boton-fantasma" onClick={() => { if (window.confirm(`¿Revocar ${NOMBRE_NIVEL[p.nivel]} a ${p.empleado}?`)) void ejecutar(() => api.revocarPermiso(p.id)) }}>
                    Revocar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fila-campos" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
        <div className="campo">
          <label htmlFor="pl-perm-emp">Otorgar a</label>
          <select id="pl-perm-emp" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
            <option value="">Elige una persona…</option>
            {datos.empleados.filter((e) => e.activo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="campo" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="pl-perm-nivel">Nivel</label>
            <select id="pl-perm-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as NivelPlanilla)}>
              {(Object.keys(NOMBRE_NIVEL) as NivelPlanilla[]).map((n) => <option key={n} value={n}>{NOMBRE_NIVEL[n]}</option>)}
            </select>
          </div>
          <button className="boton-primario" disabled={!empleadoId} onClick={() => void ejecutar(() => api.otorgarPermiso(empleadoId, nivel))}>Otorgar</button>
        </div>
      </div>

      <div className="encabezado-seccion"><h2>Clases de QuickBooks</h2></div>
      <p className="meta" style={{ marginBottom: 10 }}>Escríbelas exactamente como aparecen en QuickBooks: así saldrán en el asiento contable.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {catalogos.clases.length === 0 && <span className="meta">Aún no hay clases.</span>}
        {catalogos.clases.map((c) => (
          <span key={c.id} className={`insignia ${c.activa ? 'primaria' : 'neutra'}`} style={{ cursor: 'pointer' }}
            title={c.activa ? 'Clic para desactivar' : 'Clic para reactivar'}
            onClick={() => void ejecutar(() => api.guardarClase(c.id, c.nombre, !c.activa))}>
            {c.nombre}{!c.activa && ' (inactiva)'}
          </span>
        ))}
      </div>
      <div className="campo" style={{ display: 'flex', gap: 8, maxWidth: 460, marginBottom: 28 }}>
        <input placeholder="Nueva clase…" value={clase} onChange={(e) => setClase(e.target.value)} aria-label="Nombre de la clase nueva" />
        <button className="boton-primario" disabled={!clase.trim()} onClick={() => void ejecutar(async () => { await api.guardarClase(null, clase.trim()); setClase('') })}>Agregar</button>
      </div>

      <div className="encabezado-seccion"><h2>Bancos</h2></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {catalogos.bancos.map((b) => <span key={b.id} className="insignia neutra">{b.nombre}</span>)}
      </div>
      <div className="campo" style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
        <input placeholder="Nuevo banco…" value={banco} onChange={(e) => setBanco(e.target.value)} aria-label="Nombre del banco nuevo" />
        <button className="boton-primario" disabled={!banco.trim()} onClick={() => void ejecutar(async () => { await api.guardarBanco(null, banco.trim(), null); setBanco('') })}>Agregar</button>
      </div>
    </>
  )
}
