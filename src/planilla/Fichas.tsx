// Pestaña de fichas: lista, detalle con historial y punto de partida de los
// cambios. Los montos y cuentas llegan ya filtrados por el servidor.

import { useState } from 'react'
import { EstadoVacio, Modal } from '../ui/comunes'
import { api, mensajeDe } from './api'
import { FormularioCambio } from './FormularioCambio'
import { ResumenSeccion, dinero, fecha } from './Resumen'
import {
  NOMBRE_TIPO,
  type Catalogos, type Ficha, type Historial, type NivelPlanilla, type Seccion, type TipoSolicitud, type Vigencia,
} from './tipos'

const SECCIONES: Seccion[] = ['general', 'compensacion', 'pagadores', 'clases', 'cuenta', 'deducciones']

function vigencia(v: Vigencia): string {
  return v.vigente_hasta ? `${fecha(v.vigente_desde)} → ${fecha(v.vigente_hasta)}` : `desde ${fecha(v.vigente_desde)} (vigente)`
}

function DetalleFicha({
  ficha, catalogos, niveles, onCerrar, onCambio,
}: {
  ficha: Ficha
  catalogos: Catalogos
  niveles: NivelPlanilla[]
  onCerrar: () => void
  onCambio: (tipo: TipoSolicitud) => void
}) {
  const [historial, setHistorial] = useState<Historial | null>(null)
  const [numero, setNumero] = useState('')
  const [error, setError] = useState('')
  const puedePreparar = niveles.includes('preparacion')
  const puedeRevelar = niveles.includes('aprobacion') || niveles.includes('tesoreria')

  const verHistorial = async () => {
    setError('')
    try { setHistorial(await api.historial(ficha.empleado_id)) } catch (e) { setError(mensajeDe(e)) }
  }

  const revelar = async () => {
    const motivo = window.prompt('¿Para qué necesitas ver el número completo? (queda registrado en la bitácora)')
    if (!motivo?.trim()) return
    setError('')
    try { setNumero(await api.revelarCuenta({ empleadoId: ficha.empleado_id }, motivo.trim())) } catch (e) { setError(mensajeDe(e)) }
  }

  const datosDe = (s: Seccion): unknown => (s === 'general' ? ficha : ficha[s])

  return (
    <Modal titulo={ficha.nombre} onCerrar={onCerrar}>
      <p className="meta" style={{ marginTop: -10, marginBottom: 14 }}>
        {ficha.puesto} · asignado a {ficha.empresa_asignada ?? '—'}
        {ficha.pendientes > 0 && <> · <span className="insignia pendiente">{ficha.pendientes} cambio{ficha.pendientes === 1 ? '' : 's'} en aprobación</span></>}
      </p>
      {SECCIONES.map((s) => (
        <div key={s} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>{NOMBRE_TIPO[s]}</strong>
            {puedePreparar && (
              <button className="boton-fantasma" style={{ padding: '2px 8px', minHeight: 28 }} onClick={() => onCambio(s)}>
                Proponer cambio
              </button>
            )}
          </div>
          <ResumenSeccion seccion={s} datos={datosDe(s)} catalogos={catalogos} />
          {s === 'cuenta' && ficha.cuenta && puedeRevelar && (
            <p style={{ marginTop: 6 }}>
              {numero
                ? <span style={{ fontSize: 14 }}>Número completo: <strong style={{ letterSpacing: '0.08em' }}>{numero}</strong></span>
                : <button className="boton-fantasma" style={{ padding: '2px 8px', minHeight: 28 }} onClick={() => void revelar()}>Ver número completo</button>}
            </p>
          )}
          {historial && s !== 'general' && historial[s].length > 0 && (
            <ul className="meta" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              {historial[s].map((h, k) => {
                const fila = h as unknown as Record<string, string | number | null> & Vigencia
                const texto = s === 'compensacion' ? `${fila.concepto}${fila.descripcion ? ` (${fila.descripcion})` : ''}: ${dinero(fila.monto as number, fila.moneda as string)}`
                  : s === 'pagadores' ? `${fila.empresa} ${Number(fila.porcentaje)} %`
                  : s === 'clases' ? `${fila.clase} ${Number(fila.porcentaje)} %`
                  : s === 'cuenta' ? `${fila.banco} ••••${fila.ultimos4}`
                  : `${fila.concepto}: ${dinero(fila.monto_periodo as number, fila.moneda as string)} por período`
                return <li key={k}>{texto} — {vigencia(fila)}</li>
              })}
            </ul>
          )}
        </div>
      ))}
      {error && <p className="error-inline" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
        <button className="boton-secundario" onClick={() => void verHistorial()} disabled={historial !== null}>
          {historial ? 'Historial visible' : 'Ver historial de versiones'}
        </button>
        <button className="boton-primario" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  )
}

export function Fichas({
  fichas, catalogos, niveles, onRecargar,
}: {
  fichas: Ficha[]
  catalogos: Catalogos
  niveles: NivelPlanilla[]
  onRecargar: () => void
}) {
  const [abierta, setAbierta] = useState<Ficha | null>(null)
  const [cambio, setCambio] = useState<{ tipo: TipoSolicitud; ficha?: Ficha; empleado: { id: string; nombre: string; fecha_ingreso?: string; pais?: string } } | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const puedePreparar = niveles.includes('preparacion')

  const hecho = () => {
    setCambio(null)
    setAbierta(null)
    setAviso('Solicitud enviada a aprobación. El cambio se aplicará cuando otra persona la autorice.')
    onRecargar()
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h2>Fichas de planilla ({fichas.length})</h2>
        {puedePreparar && <button className="boton-primario" onClick={() => setEligiendo(true)}>+ Nueva ficha</button>}
      </div>
      {aviso && <p className="exito-inline" style={{ marginBottom: 12 }} role="status">{aviso}</p>}

      {fichas.length === 0 ? (
        <EstadoVacio emoji="🗂️" mensaje="Aún no hay fichas de planilla" sugerencia={puedePreparar ? 'Crea la primera con «+ Nueva ficha»; quedará pendiente de aprobación.' : 'Aparecerán aquí cuando se aprueben las altas.'} />
      ) : (
        <div className="contenedor-tabla">
          <table>
            <thead>
              <tr><th>Persona</th><th>Legislación</th><th>Pago</th><th>Salario base</th><th>Paga</th><th>Clase</th><th>Cuenta</th><th /></tr>
            </thead>
            <tbody>
              {fichas.map((f) => {
                const base = f.compensacion.find((c) => c.concepto_id === 'salario_base')
                return (
                  <tr key={f.empleado_id} style={{ opacity: f.estado === 'activa' ? 1 : 0.5 }}>
                    <td>
                      <strong>{f.nombre}</strong>
                      <span className="meta" style={{ display: 'block' }}>
                        {f.empresa_asignada ?? '—'}{f.estado !== 'activa' && ` · ${f.estado}`}
                      </span>
                    </td>
                    <td>{catalogos.legislaciones.find((l) => l.codigo === f.legislacion)?.nombre ?? f.legislacion}</td>
                    <td style={{ textTransform: 'capitalize' }}>{f.frecuencia_pago}</td>
                    <td>{base ? <strong>{dinero(base.monto, base.moneda)}</strong> : <span className="meta">—</span>}</td>
                    <td><ResumenSeccion seccion="pagadores" datos={f.pagadores} catalogos={catalogos} /></td>
                    <td><ResumenSeccion seccion="clases" datos={f.clases} catalogos={catalogos} /></td>
                    <td>{f.cuenta ? `••••${f.cuenta.ultimos4}` : <span className="insignia pendiente">Sin cuenta</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {f.pendientes > 0 && <span className="insignia pendiente" style={{ marginRight: 6 }}>{f.pendientes} en aprobación</span>}
                      <button className="boton-fantasma" onClick={() => { setAviso(''); setAbierta(f) }}>Abrir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierta && !cambio && (
        <DetalleFicha
          ficha={abierta}
          catalogos={catalogos}
          niveles={niveles}
          onCerrar={() => setAbierta(null)}
          onCambio={(tipo) => setCambio({ tipo, ficha: abierta, empleado: { id: abierta.empleado_id, nombre: abierta.nombre } })}
        />
      )}

      {eligiendo && (
        <Modal titulo="Nueva ficha de planilla" onCerrar={() => setEligiendo(false)}>
          {catalogos.empleados_sin_ficha.length === 0 ? (
            <p className="meta">
              Todas las personas registradas en Pausa ya tienen ficha o un alta en aprobación.
              Para agregar a alguien nuevo, primero créalo en Administración → Empleados.
            </p>
          ) : (
            <>
              <p className="meta" style={{ marginBottom: 12 }}>Elige a la persona (debe existir en Pausa):</p>
              <div style={{ display: 'grid', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {catalogos.empleados_sin_ficha.map((e) => (
                  <button
                    key={e.id}
                    className="boton-secundario"
                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => { setEligiendo(false); setAviso(''); setCambio({ tipo: 'alta', empleado: e }) }}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {cambio && (
        <FormularioCambio
          tipo={cambio.tipo}
          empleado={cambio.empleado}
          ficha={cambio.ficha}
          catalogos={catalogos}
          onCerrar={() => setCambio(null)}
          onHecho={hecho}
        />
      )}
    </>
  )
}
