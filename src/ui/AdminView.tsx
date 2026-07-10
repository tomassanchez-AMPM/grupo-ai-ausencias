// Consola Admin/RRHH (sección 7): gestión de empleados, configuración de
// políticas y tipos (Nivel 1 de customización), reportes y auditoría.
// Las políticas por país se muestran como solo lectura: son Nivel 2 —
// configuración técnica (sección 6). El módulo Compensación está apagado.

import { useMemo, useState } from 'react'
import { formatearDias } from '../domain/conteoDias'
import { formatearCorto, formatearLargo, parseFecha } from '../domain/fechas'
import type { CodigoPais, Empleado, TipoAusencia } from '../domain/types'
import { useStore } from '../state/store'
import { Avatar, EstadoVacio, Modal } from './comunes'

type Pestana = 'empleados' | 'politicas' | 'feriados' | 'reportes' | 'auditoria' | 'correos'

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'empleados', nombre: '👥 Empleados' },
  { id: 'politicas', nombre: '⚙️ Políticas y tipos' },
  { id: 'feriados', nombre: '🎉 Feriados' },
  { id: 'reportes', nombre: '📊 Reportes' },
  { id: 'auditoria', nombre: '📜 Auditoría' },
  { id: 'correos', nombre: '✉️ Correos enviados' },
]

// ---------- Empleados ----------

function ModalEmpleado({ original, adminId, onCerrar }: { original?: Empleado; adminId: string; onCerrar: () => void }) {
  const { datos, guardarEmpleado } = useStore()
  const [empleado, setEmpleado] = useState<Empleado>(
    original ?? {
      id: `emp-${Date.now().toString(36)}`,
      nombre: '', email: '', pais: 'NI', puesto: '',
      fechaIngreso: new Date().toISOString().slice(0, 10),
      managerId: adminId, rol: 'empleado', activo: true,
      avatarColor: ['#7c5cff', '#14b8a6', '#f59e0b', '#ec4899', '#60a5fa'][Math.floor(Math.random() * 5)],
    },
  )
  const [error, setError] = useState('')

  const guardar = () => {
    if (!empleado.nombre.trim() || !empleado.email.trim()) {
      setError('Nombre y correo son obligatorios.')
      return
    }
    guardarEmpleado(empleado)
    onCerrar()
  }

  const posiblesJefes = datos.empleados.filter((e) => e.id !== empleado.id && e.activo)

  return (
    <Modal titulo={original ? `Editar a ${original.nombre}` : 'Nuevo empleado'} onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="nombre">Nombre completo</label>
        <input id="nombre" value={empleado.nombre} onChange={(e) => setEmpleado({ ...empleado, nombre: e.target.value })} />
      </div>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" value={empleado.email} onChange={(e) => setEmpleado({ ...empleado, email: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="puesto">Puesto</label>
          <input id="puesto" value={empleado.puesto} onChange={(e) => setEmpleado({ ...empleado, puesto: e.target.value })} />
        </div>
      </div>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="pais">País (define su política)</label>
          <select id="pais" value={empleado.pais} onChange={(e) => setEmpleado({ ...empleado, pais: e.target.value as Empleado['pais'] })}>
            {datos.paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.bandera} {p.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ingreso">Fecha de ingreso</label>
          <input id="ingreso" type="date" value={empleado.fechaIngreso} onChange={(e) => setEmpleado({ ...empleado, fechaIngreso: e.target.value })} />
        </div>
      </div>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="jefe">Jefe (aprobador)</label>
          <select
            id="jefe"
            value={empleado.managerId ?? ''}
            onChange={(e) => setEmpleado({ ...empleado, managerId: e.target.value || null })}
          >
            <option value="">Sin jefe → admin designado</option>
            {posiblesJefes.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rol">Rol</label>
          <select id="rol" value={empleado.rol} onChange={(e) => setEmpleado({ ...empleado, rol: e.target.value as Empleado['rol'] })}>
            <option value="empleado">Empleado</option>
            <option value="jefe">Jefe (aprobador)</option>
            <option value="admin">Administrador / RRHH</option>
          </select>
        </div>
      </div>
      <div className="campo">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={empleado.activo} onChange={(e) => setEmpleado({ ...empleado, activo: e.target.checked })} />
          Activo
        </label>
      </div>
      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="boton-secundario" onClick={onCerrar}>Cancelar</button>
        <button className="boton-primario" onClick={guardar}>Guardar</button>
      </div>
    </Modal>
  )
}

function ModalAjuste({ empleado, adminId, onCerrar }: { empleado: Empleado; adminId: string; onCerrar: () => void }) {
  const { datos, crearAjuste, hoy } = useStore()
  const tiposConSaldo = datos.tiposAusencia.filter((t) => t.descuentaSaldo)
  const [tipoId, setTipoId] = useState(tiposConSaldo[0]?.id ?? '')
  const [dias, setDias] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  const guardar = () => {
    const numero = Number(dias)
    if (!numero || !motivo.trim()) {
      setError('Indica días (± , admite medios) y un motivo: queda en la auditoría.')
      return
    }
    crearAjuste({ empleadoId: empleado.id, tipoAusenciaId: tipoId, medioDias: Math.round(numero * 2), motivo: motivo.trim(), fecha: hoy, actorId: adminId })
    onCerrar()
  }

  return (
    <Modal titulo={`Ajustar saldo — ${empleado.nombre}`} onCerrar={onCerrar}>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="aj-tipo">Tipo de ausencia</label>
          <select id="aj-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            {tiposConSaldo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="aj-dias">Días (+ suma / − resta)</label>
          <input id="aj-dias" type="number" step="0.5" value={dias} onChange={(e) => setDias(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="aj-motivo">Motivo (obligatorio, queda en auditoría)</label>
        <input id="aj-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. compensación por feriado trabajado" />
      </div>
      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="boton-secundario" onClick={onCerrar}>Cancelar</button>
        <button className="boton-primario" onClick={guardar}>Aplicar ajuste</button>
      </div>
    </Modal>
  )
}

function PestanaEmpleados({ admin }: { admin: Empleado }) {
  const { datos, paisDe, aprobadorDe, saldoDe } = useStore()
  const [editando, setEditando] = useState<Empleado | 'nuevo' | null>(null)
  const [ajustando, setAjustando] = useState<Empleado | null>(null)

  return (
    <>
      <div className="encabezado-seccion">
        <h2>Empleados ({datos.empleados.filter((e) => e.activo).length} activos)</h2>
        <button className="boton-primario" onClick={() => setEditando('nuevo')}>+ Nuevo empleado</button>
      </div>
      <div className="contenedor-tabla">
        <table>
          <thead>
            <tr>
              <th>Persona</th><th>País</th><th>Rol</th><th>Jefe / aprobador</th><th>Vacaciones disp.</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.empleados.map((e) => {
              const pais = paisDe(e)
              const aprobador = aprobadorDe(e)
              const saldo = saldoDe(e, 'vacaciones')
              return (
                <tr key={e.id} style={{ opacity: e.activo ? 1 : 0.45 }}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar empleado={e} />
                      <span>
                        <strong>{e.nombre}</strong>
                        <span className="meta" style={{ display: 'block' }}>{e.puesto}{!e.activo && ' · inactivo'}</span>
                      </span>
                    </span>
                  </td>
                  <td>{pais.bandera} {pais.nombre}</td>
                  <td><span className={`insignia ${e.rol === 'admin' ? 'primaria' : 'neutra'}`}>{e.rol === 'admin' ? 'Admin/RRHH' : e.rol === 'jefe' ? 'Jefe' : 'Empleado'}</span></td>
                  <td>{e.managerId ? aprobador.nombre : <span className="meta">{aprobador.nombre} (designado)</span>}</td>
                  <td>{saldo ? <strong>{formatearDias(Math.max(saldo.disponibleMedios, 0))}</strong> : <span className="meta">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="boton-fantasma" onClick={() => setEditando(e)}>Editar</button>
                    <button className="boton-fantasma" onClick={() => setAjustando(e)}>Ajustar saldo</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editando && (
        <ModalEmpleado original={editando === 'nuevo' ? undefined : editando} adminId={admin.id} onCerrar={() => setEditando(null)} />
      )}
      {ajustando && <ModalAjuste empleado={ajustando} adminId={admin.id} onCerrar={() => setAjustando(null)} />}
    </>
  )
}

// ---------- Políticas y tipos ----------

function ModalTipo({ original, onCerrar }: { original?: TipoAusencia; onCerrar: () => void }) {
  const { guardarTipoAusencia } = useStore()
  const [tipo, setTipo] = useState<TipoAusencia>(
    original ?? {
      id: `tipo-${Date.now().toString(36)}`,
      nombre: '', descuentaSaldo: false, afectaNomina: false, requiereAdjunto: false,
      color: '#60a5fa', icono: '📌',
    },
  )
  const [error, setError] = useState('')

  const guardar = () => {
    if (!tipo.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    guardarTipoAusencia(tipo)
    onCerrar()
  }

  return (
    <Modal titulo={original ? `Editar tipo: ${original.nombre}` : 'Nuevo tipo de ausencia'} onCerrar={onCerrar}>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="t-nombre">Nombre</label>
          <input id="t-nombre" value={tipo.nombre} onChange={(e) => setTipo({ ...tipo, nombre: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="t-icono">Ícono (emoji)</label>
          <input id="t-icono" value={tipo.icono} onChange={(e) => setTipo({ ...tipo, icono: e.target.value })} maxLength={4} />
        </div>
      </div>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="t-color">Color</label>
          <input id="t-color" type="color" value={tipo.color} onChange={(e) => setTipo({ ...tipo, color: e.target.value })} style={{ height: 44, padding: 4 }} />
        </div>
        <div className="campo">
          <label htmlFor="t-tope">Tope anual en días (vacío = sin tope)</label>
          <input
            id="t-tope" type="number" min={0} step={0.5}
            value={tipo.topeAnualDias ?? ''}
            onChange={(e) => setTipo({ ...tipo, topeAnualDias: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      </div>
      {([
        ['descuentaSaldo', '¿Descuenta saldo de vacaciones?'],
        ['afectaNomina', '¿Afecta la nómina (descuenta pago)?'],
        ['requiereAdjunto', '¿Requiere documento adjunto?'],
      ] as const).map(([clave, texto]) => (
        <div className="campo" key={clave}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={tipo[clave]} onChange={(e) => setTipo({ ...tipo, [clave]: e.target.checked })} />
            {texto}
          </label>
        </div>
      ))}
      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="boton-secundario" onClick={onCerrar}>Cancelar</button>
        <button className="boton-primario" onClick={guardar}>Guardar tipo</button>
      </div>
    </Modal>
  )
}

const NOMBRE_ACUMULACION = { anual: 'Anual de golpe (1 de enero)', mensual: 'Prorrateo mensual', quincenal: 'Prorrateo quincenal' }
const NOMBRE_CONTEO = { laborables: 'Días laborables', corridos_sin_feriados: 'Corridos sin feriados', corridos: 'Días corridos' }

function PestanaPoliticas() {
  const { datos } = useStore()
  const [editandoTipo, setEditandoTipo] = useState<TipoAusencia | 'nuevo' | null>(null)

  return (
    <>
      <div className="encabezado-seccion">
        <h2>Tipos de ausencia <span className="insignia primaria">Nivel 1 · autoservicio</span></h2>
        <button className="boton-primario" onClick={() => setEditandoTipo('nuevo')}>+ Nuevo tipo</button>
      </div>
      <div className="contenedor-tabla" style={{ marginBottom: 28 }}>
        <table>
          <thead>
            <tr><th>Tipo</th><th>¿Descuenta saldo?</th><th>¿Afecta nómina?</th><th>¿Requiere adjunto?</th><th>Tope anual</th><th></th></tr>
          </thead>
          <tbody>
            {datos.tiposAusencia.map((t) => (
              <tr key={t.id}>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="punto" style={{ background: t.color, width: 12, height: 12 }} />{t.icono} <strong>{t.nombre}</strong></span></td>
                <td>{t.descuentaSaldo ? 'Sí' : 'No'}</td>
                <td>{t.afectaNomina ? 'Sí' : 'No'}</td>
                <td>{t.requiereAdjunto ? 'Sí' : 'No'}</td>
                <td>{t.topeAnualDias != null ? `${t.topeAnualDias} días` : <span className="meta">—</span>}</td>
                <td><button className="boton-fantasma" onClick={() => setEditandoTipo(t)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="encabezado-seccion">
        <h2>Políticas de acumulación por país <span className="insignia neutra">Nivel 2 · configuración técnica</span></h2>
      </div>
      <p className="nota-info" style={{ marginBottom: 14 }}>
        Estas reglas estructurales (país nuevo, método de acumulación, conteo de días) se modifican por configuración técnica, no desde la interfaz — sección 6 del documento de diseño.
      </p>
      <div className="tarjetas-saldo">
        {datos.politicas.map((p) => {
          const pais = datos.paises.find((x) => x.codigo === p.pais)
          return (
            <div className="tarjeta" key={p.id}>
              <h3>{pais?.bandera} {p.nombre}</h3>
              <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13.5 }}>
                <p><span className="meta">Acumulación:</span> {NOMBRE_ACUMULACION[p.metodoAcumulacion]}</p>
                <p><span className="meta">Días por año:</span> <strong>{p.diasPorAnio}</strong>{p.reglasAntiguedad.length > 0 && <span className="meta"> + antigüedad ({p.reglasAntiguedad.map((r) => `${r.aPartirDeAnios}a→+${r.diasExtra}`).join(', ')})</span>}</p>
                <p><span className="meta">Conteo de días:</span> {pais ? NOMBRE_CONTEO[pais.metodoConteo] : '—'}</p>
                <p><span className="meta">Carryover:</span> {p.carryoverMaxDias != null ? (p.carryoverMaxDias === 0 ? 'No permite' : `máx. ${p.carryoverMaxDias} días`) : 'ilimitado'}{p.carryoverExpira && `, vence ${p.carryoverExpira.dia}/${p.carryoverExpira.mes}`}</p>
                {p.topeMultiplicador && <p><span className="meta">Tope:</span> {p.topeMultiplicador}× el anual</p>}
              </div>
            </div>
          )
        })}
      </div>
      {editandoTipo && <ModalTipo original={editandoTipo === 'nuevo' ? undefined : editandoTipo} onCerrar={() => setEditandoTipo(null)} />}
    </>
  )
}

// ---------- Feriados ----------
// Los feriados cambian cada año: son mantenimiento frecuente, así que se
// promueven a Nivel 1 (autoservicio del admin). Afectan el conteo de las
// solicitudes NUEVAS; las ya creadas conservan sus días calculados.

function PestanaFeriados({ admin }: { admin: Empleado }) {
  const { datos, hoy, agregarFeriado, eliminarFeriado } = useStore()
  const [paisActivo, setPaisActivo] = useState<CodigoPais>('NI')
  const [fecha, setFecha] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')

  const anioActual = parseFecha(hoy).getFullYear()
  const feriadosDelPais = datos.feriados
    .filter((f) => f.pais === paisActivo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const pais = datos.paises.find((p) => p.codigo === paisActivo)

  const agregar = () => {
    setError('')
    const resultado = agregarFeriado({ pais: paisActivo, fecha, descripcion }, admin.id)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setFecha('')
    setDescripcion('')
  }

  return (
    <>
      <p className="nota-info" style={{ marginBottom: 16 }}>
        🎉 Los feriados definen qué días descuenta una solicitud según el método de cada país.
        Cárgalos año con año. Los cambios aplican a solicitudes nuevas; las ya registradas
        conservan los días calculados al crearse.
      </p>

      <div className="segmento" style={{ maxWidth: 520, marginBottom: 18 }} role="tablist" aria-label="País">
        {datos.paises.map((p) => (
          <button
            key={p.codigo}
            className={paisActivo === p.codigo ? 'activo' : ''}
            onClick={() => { setPaisActivo(p.codigo); setError('') }}
            role="tab"
            aria-selected={paisActivo === p.codigo}
          >
            {p.bandera} {p.nombre}
          </button>
        ))}
      </div>

      <div className="tarjeta" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Agregar feriado — {pais?.bandera} {pais?.nombre}</h3>
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="fer-fecha">Fecha</label>
            <input id="fer-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="fer-desc">Nombre del feriado</label>
            <input
              id="fer-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Día de la Independencia"
            />
          </div>
        </div>
        {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
        <button className="boton-primario" onClick={agregar} disabled={!fecha || !descripcion.trim()}>
          + Agregar feriado
        </button>
      </div>

      {feriadosDelPais.length === 0 ? (
        <EstadoVacio
          emoji="🗓️"
          mensaje={`Sin feriados cargados para ${pais?.nombre}`}
          sugerencia="Agrega el calendario oficial del año con el formulario de arriba."
        />
      ) : (
        <div className="contenedor-tabla">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Feriado</th><th></th></tr>
            </thead>
            <tbody>
              {feriadosDelPais.map((f) => {
                const esPasado = f.fecha < hoy
                const esOtroAnio = parseFecha(f.fecha).getFullYear() !== anioActual
                return (
                  <tr key={f.id} style={{ opacity: esPasado ? 0.55 : 1 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatearLargo(f.fecha)}
                      {esOtroAnio && <span className="insignia neutra" style={{ marginLeft: 8 }}>{parseFecha(f.fecha).getFullYear()}</span>}
                    </td>
                    <td>{f.descripcion}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="boton-fantasma" onClick={() => eliminarFeriado(f.id, admin.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ---------- Reportes ----------

function PestanaReportes() {
  const { datos, hoy, paisDe } = useStore()
  const anio = hoy.slice(0, 4)

  const resumen = useMemo(() => {
    const aprobadasAnio = datos.solicitudes.filter((s) => s.estado === 'aprobada' && s.fechaInicio.startsWith(anio))
    const pendientes = datos.solicitudes.filter((s) => s.estado === 'pendiente')
    const ausentesHoy = datos.solicitudes.filter(
      (s) => s.estado === 'aprobada' && s.fechaInicio <= hoy && s.fechaFin >= hoy,
    )
    const porPais = new Map<string, number>()
    const porTipo = new Map<string, number>()
    for (const s of aprobadasAnio) {
      const empleado = datos.empleados.find((e) => e.id === s.empleadoId)
      if (empleado) {
        const pais = paisDe(empleado)
        porPais.set(pais.nombre, (porPais.get(pais.nombre) ?? 0) + s.medioDias)
      }
      const tipo = datos.tiposAusencia.find((t) => t.id === s.tipoAusenciaId)
      if (tipo) porTipo.set(tipo.nombre, (porTipo.get(tipo.nombre) ?? 0) + s.medioDias)
    }
    return { aprobadasAnio, pendientes, ausentesHoy, porPais, porTipo }
  }, [datos, hoy, anio, paisDe])

  const maxPais = Math.max(...[...resumen.porPais.values()], 1)
  const maxTipo = Math.max(...[...resumen.porTipo.values()], 1)

  return (
    <>
      <div className="kpis">
        <div className="kpi"><p className="valor">{resumen.ausentesHoy.length}</p><p className="etiqueta">Ausentes hoy</p></div>
        <div className="kpi"><p className="valor">{resumen.pendientes.length}</p><p className="etiqueta">Solicitudes pendientes</p></div>
        <div className="kpi"><p className="valor">{formatearDias(resumen.aprobadasAnio.reduce((t, s) => t + s.medioDias, 0))}</p><p className="etiqueta">Días aprobados en {anio}</p></div>
        <div className="kpi"><p className="valor">{datos.empleados.filter((e) => e.activo).length}</p><p className="etiqueta">Empleados activos</p></div>
      </div>

      <div className="tarjetas-saldo">
        <div className="tarjeta">
          <h3 style={{ marginBottom: 12 }}>Días usados por país ({anio})</h3>
          {resumen.porPais.size === 0 ? (
            <p className="meta">Sin datos este año.</p>
          ) : (
            [...resumen.porPais.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, medios]) => (
              <div key={nombre} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span>{nombre}</span><strong>{formatearDias(medios)}</strong>
                </div>
                <div className="barra-progreso"><div style={{ width: `${(medios / maxPais) * 100}%`, background: 'var(--primario)' }} /></div>
              </div>
            ))
          )}
        </div>
        <div className="tarjeta">
          <h3 style={{ marginBottom: 12 }}>Días usados por tipo ({anio})</h3>
          {resumen.porTipo.size === 0 ? (
            <p className="meta">Sin datos este año.</p>
          ) : (
            [...resumen.porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, medios]) => {
              const tipo = datos.tiposAusencia.find((t) => t.nombre === nombre)
              return (
                <div key={nombre} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span>{nombre}</span><strong>{formatearDias(medios)}</strong>
                  </div>
                  <div className="barra-progreso"><div style={{ width: `${(medios / maxTipo) * 100}%`, background: tipo?.color ?? 'var(--primario)' }} /></div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {resumen.ausentesHoy.length > 0 && (
        <div className="tarjeta" style={{ marginTop: 14 }}>
          <h3 style={{ marginBottom: 10 }}>Quién está ausente hoy</h3>
          {resumen.ausentesHoy.map((s) => {
            const empleado = datos.empleados.find((e) => e.id === s.empleadoId)
            const tipo = datos.tiposAusencia.find((t) => t.id === s.tipoAusenciaId)
            if (!empleado || !tipo) return null
            return (
              <p key={s.id} style={{ fontSize: 14, padding: '4px 0' }}>
                {tipo.icono} <strong>{empleado.nombre}</strong> — {tipo.nombre} hasta {formatearCorto(s.fechaFin)}
              </p>
            )
          })}
        </div>
      )}
    </>
  )
}

// ---------- Auditoría y correos ----------

function PestanaAuditoria() {
  const { datos } = useStore()
  const ordenada = [...datos.auditoria].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <>
      <p className="nota-info" style={{ marginBottom: 16 }}>
        📜 Registro inmutable (sección 7.1): cada acción queda sellada con quién, cuándo y bajo qué política — respaldo ante auditorías laborales.
      </p>
      <div className="contenedor-tabla">
        <table>
          <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {ordenada.map((r) => {
              const actor = datos.empleados.find((e) => e.id === r.actorId)
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{actor?.nombre ?? r.actorId}</td>
                  <td><span className="insignia neutra">{r.accion}</span></td>
                  <td>{r.detalle}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PestanaCorreos() {
  const { datos } = useStore()
  const ordenados = [...datos.correos].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <>
      <p className="nota-info" style={{ marginBottom: 16 }}>
        ✉️ Simulación del canal de correo del prototipo: en producción estos mensajes saldrían por SMTP/servicio de email, además de la notificación en la app.
      </p>
      {ordenados.length === 0 ? (
        <EstadoVacio emoji="📭" mensaje="Aún no se han enviado correos" />
      ) : (
        ordenados.map((c) => (
          <div className="tarjeta" key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14.5 }}>{c.asunto}</strong>
              <span className="meta">{new Date(c.timestamp).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="meta">Para: {c.para}</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>{c.cuerpo}</p>
          </div>
        ))
      )}
    </>
  )
}

// ---------- Vista principal ----------

export function AdminView({ admin }: { admin: Empleado }) {
  const [pestana, setPestana] = useState<Pestana>('empleados')
  const { datos } = useStore()
  const pendientesTotales = datos.solicitudes.filter((s) => s.estado === 'pendiente').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Avatar empleado={admin} grande />
        <div>
          <h1>Administración · RRHH</h1>
          <p className="meta">{admin.nombre} · {pendientesTotales} solicitud{pendientesTotales === 1 ? '' : 'es'} pendiente{pendientesTotales === 1 ? '' : 's'} en toda la organización</p>
        </div>
      </div>

      <nav className="pestanas" aria-label="Secciones de administración">
        {PESTANAS.map((p) => (
          <button key={p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)} aria-current={pestana === p.id}>
            {p.nombre}
          </button>
        ))}
      </nav>

      {pestana === 'empleados' && <PestanaEmpleados admin={admin} />}
      {pestana === 'politicas' && <PestanaPoliticas />}
      {pestana === 'feriados' && <PestanaFeriados admin={admin} />}
      {pestana === 'reportes' && <PestanaReportes />}
      {pestana === 'auditoria' && <PestanaAuditoria />}
      {pestana === 'correos' && <PestanaCorreos />}
    </div>
  )
}
