// Formulario de solicitud de cambio. Sirve para el alta completa de una ficha
// o para cambiar una sola sección. Nunca escribe en la ficha: crea una
// solicitud que otra persona debe aprobar (doble control, impuesto en la base).

import { useState } from 'react'
import { Modal } from '../ui/comunes'
import { api, mensajeDe } from './api'
import {
  MONEDAS, NOMBRE_TIPO,
  type Catalogos, type DatosGenerales, type Ficha, type Frecuencia, type ItemDeduccion, type PayloadAlta,
  type Seccion, type TipoSolicitud,
} from './tipos'

interface Borrador {
  general: DatosGenerales
  moneda: string
  salarioBase: string
  viatico: string
  otros: { descripcion: string; monto: string }[]
  pagadores: { empresa_id: string; porcentaje: string }[]
  clases: { clase_id: string; porcentaje: string }[]
  conCuenta: boolean
  cuenta: { banco_id: string; tipo_cuenta: 'ahorro' | 'corriente'; moneda: string; titular: string; identificacion: string }
  numeroCuenta: string
  deducciones: { concepto_id: string; descripcion: string; monto_periodo: string; es_prestamo: boolean; monto_original: string; saldo_inicial: string }[]
}

const hoyISO = () => new Date().toISOString().slice(0, 10)
const numero = (texto: string) => Number(texto.replace(',', '.'))

function borradorInicial(catalogos: Catalogos, nombre: string, ficha?: Ficha, sugerido?: { fecha_ingreso: string; pais: string }): Borrador {
  const comp = ficha?.compensacion ?? []
  const base = comp.find((c) => c.concepto_id === 'salario_base')
  const viatico = comp.find((c) => c.concepto_id === 'viatico')
  const moneda = base?.moneda ?? ficha?.moneda ?? 'USD'
  return {
    general: {
      legislacion: ficha?.legislacion ?? sugerido?.pais ?? 'NI',
      frecuencia_pago: ficha?.frecuencia_pago ?? 'mensual',
      moneda: ficha?.moneda ?? 'USD',
      fecha_ingreso_original: ficha?.fecha_ingreso_original ?? sugerido?.fecha_ingreso ?? hoyISO(),
      fecha_ultima_liquidacion: ficha?.fecha_ultima_liquidacion ?? null,
      estado: ficha?.estado ?? 'activa',
    },
    moneda,
    salarioBase: base ? String(base.monto) : '',
    viatico: viatico ? String(viatico.monto) : '',
    otros: comp.filter((c) => c.concepto_id === 'otros_pagos').map((c) => ({ descripcion: c.descripcion ?? '', monto: String(c.monto) })),
    pagadores: ficha?.pagadores.length
      ? ficha.pagadores.map((p) => ({ empresa_id: p.empresa_id, porcentaje: String(Number(p.porcentaje)) }))
      : [{ empresa_id: catalogos.empresas.find((e) => e.id === 'clovertale')?.id ?? catalogos.empresas[0]?.id ?? '', porcentaje: '100' }],
    clases: ficha?.clases.length
      ? ficha.clases.map((c) => ({ clase_id: c.clase_id, porcentaje: String(Number(c.porcentaje)) }))
      : [{ clase_id: catalogos.clases.find((c) => c.activa)?.id ?? '', porcentaje: '100' }],
    conCuenta: !ficha,
    cuenta: {
      banco_id: ficha?.cuenta?.banco_id ?? catalogos.bancos.find((b) => b.activo)?.id ?? '',
      tipo_cuenta: ficha?.cuenta?.tipo_cuenta ?? 'ahorro',
      moneda: ficha?.cuenta?.moneda ?? moneda,
      titular: ficha?.cuenta?.titular ?? nombre,
      identificacion: ficha?.cuenta?.identificacion ?? '',
    },
    numeroCuenta: '',
    deducciones: (ficha?.deducciones ?? []).map((d) => ({
      concepto_id: d.concepto_id, descripcion: d.descripcion ?? '', monto_periodo: String(d.monto_periodo),
      es_prestamo: d.es_prestamo, monto_original: d.monto_original != null ? String(d.monto_original) : '',
      saldo_inicial: d.saldo_inicial != null ? String(d.saldo_inicial) : '',
    })),
  }
}

/** Convierte el borrador en el payload que espera el servidor; lanza un
 *  mensaje claro si algo no cuadra (el servidor valida de nuevo). */
function construir(b: Borrador, seccion: Seccion): unknown {
  if (seccion === 'general') return b.general

  if (seccion === 'compensacion') {
    const base = numero(b.salarioBase)
    if (!(base > 0)) throw new Error('El salario base debe ser mayor que cero.')
    const items = [{ concepto_id: 'salario_base', monto: base, moneda: b.moneda }]
    if (b.viatico.trim() && numero(b.viatico) > 0) items.push({ concepto_id: 'viatico', monto: numero(b.viatico), moneda: b.moneda })
    for (const o of b.otros) {
      if (!o.monto.trim()) continue
      if (!o.descripcion.trim()) throw new Error('Describe cada pago adicional.')
      items.push({ concepto_id: 'otros_pagos', monto: numero(o.monto), moneda: b.moneda, descripcion: o.descripcion.trim() } as typeof items[number])
    }
    if (items.some((i) => Number.isNaN(i.monto) || i.monto < 0)) throw new Error('Revisa los montos: deben ser números positivos.')
    return items
  }

  if (seccion === 'pagadores') {
    const items = b.pagadores.map((p) => ({ empresa_id: p.empresa_id, porcentaje: numero(p.porcentaje) }))
    if (items.some((i) => !i.empresa_id)) throw new Error('Elige la empresa pagadora en cada fila.')
    const suma = items.reduce((t, i) => t + i.porcentaje, 0)
    if (Math.abs(suma - 100) > 0.001) throw new Error(`Las empresas pagadoras deben sumar 100 % (suman ${suma}).`)
    return items
  }

  if (seccion === 'clases') {
    const items = b.clases.map((c) => ({ clase_id: c.clase_id, porcentaje: numero(c.porcentaje) }))
    if (items.some((i) => !i.clase_id)) throw new Error('Elige la clase en cada fila (el administrador de planilla las crea en Configuración).')
    const suma = items.reduce((t, i) => t + i.porcentaje, 0)
    if (Math.abs(suma - 100) > 0.001) throw new Error(`Las clases deben sumar 100 % (suman ${suma}).`)
    return items
  }

  if (seccion === 'cuenta') {
    if (!b.cuenta.banco_id) throw new Error('Elige el banco.')
    if (!b.cuenta.titular.trim()) throw new Error('Indica el titular de la cuenta.')
    if (b.numeroCuenta.replace(/[\s-]/g, '').length < 4) throw new Error('Escribe el número de cuenta completo.')
    return { ...b.cuenta, titular: b.cuenta.titular.trim(), identificacion: b.cuenta.identificacion.trim() || null }
  }

  return b.deducciones.map((d): ItemDeduccion => {
    const monto = numero(d.monto_periodo)
    if (!(monto > 0)) throw new Error('Cada deducción necesita un monto por período mayor que cero.')
    return {
      concepto_id: d.concepto_id, descripcion: d.descripcion.trim() || null, monto_periodo: monto, moneda: b.moneda,
      es_prestamo: d.es_prestamo,
      monto_original: d.es_prestamo ? numero(d.monto_original) : null,
      saldo_inicial: d.es_prestamo ? numero(d.saldo_inicial) : null,
    }
  })
}

export function FormularioCambio({
  tipo, empleado, ficha, catalogos, onCerrar, onHecho,
}: {
  tipo: TipoSolicitud
  empleado: { id: string; nombre: string; fecha_ingreso?: string; pais?: string }
  ficha?: Ficha
  catalogos: Catalogos
  onCerrar: () => void
  onHecho: () => void
}) {
  const [b, setB] = useState<Borrador>(() =>
    borradorInicial(catalogos, empleado.nombre, ficha,
      empleado.fecha_ingreso && empleado.pais ? { fecha_ingreso: empleado.fecha_ingreso, pais: empleado.pais } : undefined))
  const [vigenteDesde, setVigenteDesde] = useState(hoyISO())
  const [motivo, setMotivo] = useState(tipo === 'alta' ? 'Alta en planilla' : '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const muestra = (s: Seccion) => tipo === 'alta' || tipo === s
  const conceptosDeduccion = catalogos.conceptos.filter((c) => c.tipo === 'deduccion')

  const enviar = async () => {
    setError('')
    if (!motivo.trim()) { setError('Escribe el motivo del cambio: queda en la bitácora.'); return }
    let payload: unknown
    let numeroCuenta: string | undefined
    try {
      if (tipo === 'alta') {
        const alta: PayloadAlta = {
          general: construir(b, 'general') as PayloadAlta['general'],
          compensacion: construir(b, 'compensacion') as PayloadAlta['compensacion'],
          pagadores: construir(b, 'pagadores') as PayloadAlta['pagadores'],
          clases: construir(b, 'clases') as PayloadAlta['clases'],
        }
        if (b.conCuenta) {
          alta.cuenta = construir(b, 'cuenta') as PayloadAlta['cuenta']
          numeroCuenta = b.numeroCuenta
        }
        if (b.deducciones.length > 0) alta.deducciones = construir(b, 'deducciones') as PayloadAlta['deducciones']
        payload = alta
      } else {
        payload = construir(b, tipo)
        if (tipo === 'cuenta') numeroCuenta = b.numeroCuenta
      }
    } catch (e) {
      setError(mensajeDe(e))
      return
    }
    setEnviando(true)
    try {
      await api.crearSolicitud({ empleadoId: empleado.id, tipo, payload, vigenteDesde, motivo: motivo.trim(), numeroCuenta })
      onHecho()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setEnviando(false)
    }
  }

  const subtitulo = (texto: string) => tipo === 'alta' && <h3 style={{ margin: '18px 0 10px', fontSize: 15 }}>{texto}</h3>

  return (
    <Modal titulo={`${NOMBRE_TIPO[tipo]} — ${empleado.nombre}`} onCerrar={onCerrar}>
      <p className="nota-info" style={{ marginBottom: 14 }}>
        Esto crea una <strong>solicitud</strong>: el cambio se aplica cuando otra persona con nivel
        de aprobación la autoriza. Nada se sobrescribe; la versión anterior queda en el historial.
      </p>

      {muestra('general') && (
        <>
          {subtitulo('Datos generales')}
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pl-leg">Legislación laboral aplicable</label>
              <select id="pl-leg" value={b.general.legislacion} onChange={(e) => setB({ ...b, general: { ...b.general, legislacion: e.target.value } })}>
                {catalogos.legislaciones.map((l) => <option key={l.codigo} value={l.codigo}>{l.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="pl-frec">Frecuencia de pago</label>
              <select id="pl-frec" value={b.general.frecuencia_pago} onChange={(e) => setB({ ...b, general: { ...b.general, frecuencia_pago: e.target.value as Frecuencia } })}>
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pl-ing">Fecha de ingreso original</label>
              <input id="pl-ing" type="date" value={b.general.fecha_ingreso_original} onChange={(e) => setB({ ...b, general: { ...b.general, fecha_ingreso_original: e.target.value } })} />
            </div>
            <div className="campo">
              <label htmlFor="pl-liq">Fecha de última liquidación (si hubo)</label>
              <input id="pl-liq" type="date" value={b.general.fecha_ultima_liquidacion ?? ''} onChange={(e) => setB({ ...b, general: { ...b.general, fecha_ultima_liquidacion: e.target.value || null } })} />
            </div>
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pl-mon">Moneda de pago</label>
              <select id="pl-mon" value={b.general.moneda} onChange={(e) => setB({ ...b, general: { ...b.general, moneda: e.target.value }, moneda: tipo === 'alta' ? e.target.value : b.moneda })}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {tipo === 'general' ? (
              <div className="campo">
                <label htmlFor="pl-est">Estado de la ficha</label>
                <select id="pl-est" value={b.general.estado} onChange={(e) => setB({ ...b, general: { ...b.general, estado: e.target.value as DatosGenerales['estado'] } })}>
                  <option value="activa">Activa</option>
                  <option value="suspendida">Suspendida</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            ) : <div className="campo" />}
          </div>
        </>
      )}

      {muestra('compensacion') && (
        <>
          {subtitulo('Compensación')}
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pl-base">Salario base ({b.moneda})</label>
              <input id="pl-base" inputMode="decimal" value={b.salarioBase} onChange={(e) => setB({ ...b, salarioBase: e.target.value })} placeholder="0.00" />
            </div>
            <div className="campo">
              <label htmlFor="pl-via">Viático ({b.moneda}, opcional)</label>
              <input id="pl-via" inputMode="decimal" value={b.viatico} onChange={(e) => setB({ ...b, viatico: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          {tipo === 'compensacion' && (
            <div className="campo" style={{ maxWidth: 200 }}>
              <label htmlFor="pl-cmon">Moneda</label>
              <select id="pl-cmon" value={b.moneda} onChange={(e) => setB({ ...b, moneda: e.target.value })}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {b.otros.map((o, k) => (
            <div className="fila-campos" key={k}>
              <div className="campo">
                <label>Otro pago — descripción</label>
                <input value={o.descripcion} onChange={(e) => setB({ ...b, otros: b.otros.map((x, j) => j === k ? { ...x, descripcion: e.target.value } : x) })} placeholder="Ej. bono de alquiler" />
              </div>
              <div className="campo" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>Monto ({b.moneda})</label>
                  <input inputMode="decimal" value={o.monto} onChange={(e) => setB({ ...b, otros: b.otros.map((x, j) => j === k ? { ...x, monto: e.target.value } : x) })} />
                </div>
                <button className="boton-fantasma" onClick={() => setB({ ...b, otros: b.otros.filter((_, j) => j !== k) })} aria-label="Quitar pago">✕</button>
              </div>
            </div>
          ))}
          <button className="boton-fantasma" onClick={() => setB({ ...b, otros: [...b.otros, { descripcion: '', monto: '' }] })}>+ Agregar otro pago</button>
        </>
      )}

      {muestra('pagadores') && (
        <>
          {subtitulo('Empresas que pagan (deben sumar 100 %)')}
          {b.pagadores.map((p, k) => (
            <div className="fila-campos" key={k}>
              <div className="campo">
                <label>Empresa pagadora</label>
                <select value={p.empresa_id} onChange={(e) => setB({ ...b, pagadores: b.pagadores.map((x, j) => j === k ? { ...x, empresa_id: e.target.value } : x) })}>
                  <option value="">Elige…</option>
                  {catalogos.empresas.map((em) => <option key={em.id} value={em.id}>{em.nombre}</option>)}
                </select>
              </div>
              <div className="campo" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>Porcentaje</label>
                  <input inputMode="decimal" value={p.porcentaje} onChange={(e) => setB({ ...b, pagadores: b.pagadores.map((x, j) => j === k ? { ...x, porcentaje: e.target.value } : x) })} />
                </div>
                {b.pagadores.length > 1 && <button className="boton-fantasma" onClick={() => setB({ ...b, pagadores: b.pagadores.filter((_, j) => j !== k) })} aria-label="Quitar empresa">✕</button>}
              </div>
            </div>
          ))}
          <button className="boton-fantasma" onClick={() => setB({ ...b, pagadores: [...b.pagadores, { empresa_id: '', porcentaje: '' }] })}>+ Agregar empresa pagadora</button>
        </>
      )}

      {muestra('clases') && (
        <>
          {subtitulo('Clases de QuickBooks (deben sumar 100 %)')}
          {catalogos.clases.filter((c) => c.activa).length === 0 && (
            <p className="error-inline" style={{ marginBottom: 10 }}>
              Aún no hay clases en el catálogo: el administrador de planilla debe crearlas en Configuración.
            </p>
          )}
          {b.clases.map((c, k) => (
            <div className="fila-campos" key={k}>
              <div className="campo">
                <label>Clase</label>
                <select value={c.clase_id} onChange={(e) => setB({ ...b, clases: b.clases.map((x, j) => j === k ? { ...x, clase_id: e.target.value } : x) })}>
                  <option value="">Elige…</option>
                  {catalogos.clases.filter((cl) => cl.activa).map((cl) => <option key={cl.id} value={cl.id}>{cl.nombre}</option>)}
                </select>
              </div>
              <div className="campo" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>Porcentaje</label>
                  <input inputMode="decimal" value={c.porcentaje} onChange={(e) => setB({ ...b, clases: b.clases.map((x, j) => j === k ? { ...x, porcentaje: e.target.value } : x) })} />
                </div>
                {b.clases.length > 1 && <button className="boton-fantasma" onClick={() => setB({ ...b, clases: b.clases.filter((_, j) => j !== k) })} aria-label="Quitar clase">✕</button>}
              </div>
            </div>
          ))}
          <button className="boton-fantasma" onClick={() => setB({ ...b, clases: [...b.clases, { clase_id: '', porcentaje: '' }] })}>+ Agregar clase</button>
        </>
      )}

      {muestra('cuenta') && (
        <>
          {subtitulo('Cuenta bancaria para el pago')}
          {tipo === 'alta' && (
            <div className="campo">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={b.conCuenta} onChange={(e) => setB({ ...b, conCuenta: e.target.checked })} />
                Registrar la cuenta ahora (se puede agregar después)
              </label>
            </div>
          )}
          {(tipo === 'cuenta' || b.conCuenta) && (
            <>
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="pl-banco">Banco</label>
                  <select id="pl-banco" value={b.cuenta.banco_id} onChange={(e) => setB({ ...b, cuenta: { ...b.cuenta, banco_id: e.target.value } })}>
                    <option value="">Elige…</option>
                    {catalogos.bancos.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="pl-tipoc">Tipo de cuenta</label>
                  <select id="pl-tipoc" value={b.cuenta.tipo_cuenta} onChange={(e) => setB({ ...b, cuenta: { ...b.cuenta, tipo_cuenta: e.target.value as 'ahorro' | 'corriente' } })}>
                    <option value="ahorro">Ahorro</option>
                    <option value="corriente">Corriente</option>
                  </select>
                </div>
              </div>
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="pl-num">Número de cuenta</label>
                  <input id="pl-num" autoComplete="off" value={b.numeroCuenta} onChange={(e) => setB({ ...b, numeroCuenta: e.target.value })} placeholder="Se guarda cifrado" />
                </div>
                <div className="campo">
                  <label htmlFor="pl-cmoneda">Moneda de la cuenta</label>
                  <select id="pl-cmoneda" value={b.cuenta.moneda} onChange={(e) => setB({ ...b, cuenta: { ...b.cuenta, moneda: e.target.value } })}>
                    {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="pl-tit">Titular (como figura en el banco)</label>
                  <input id="pl-tit" value={b.cuenta.titular} onChange={(e) => setB({ ...b, cuenta: { ...b.cuenta, titular: e.target.value } })} />
                </div>
                <div className="campo">
                  <label htmlFor="pl-ident">Identificación del titular (opcional)</label>
                  <input id="pl-ident" value={b.cuenta.identificacion} onChange={(e) => setB({ ...b, cuenta: { ...b.cuenta, identificacion: e.target.value } })} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {muestra('deducciones') && (
        <>
          {subtitulo('Deducciones')}
          {tipo === 'deducciones' && (
            <p className="meta" style={{ marginBottom: 10 }}>
              Esta lista reemplaza a la vigente desde la fecha indicada: deja solo las deducciones que deben seguir.
            </p>
          )}
          {b.deducciones.map((d, k) => {
            const cambiar = (parcial: Partial<Borrador['deducciones'][number]>) =>
              setB({ ...b, deducciones: b.deducciones.map((x, j) => j === k ? { ...x, ...parcial } : x) })
            return (
              <div key={k} style={{ borderLeft: '3px solid var(--border)', paddingLeft: 12, marginBottom: 12 }}>
                <div className="fila-campos">
                  <div className="campo">
                    <label>Tipo de deducción</label>
                    <select value={d.concepto_id} onChange={(e) => cambiar({ concepto_id: e.target.value, es_prestamo: e.target.value === 'prestamo_empleado' })}>
                      {conceptosDeduccion.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label>Monto por período ({b.moneda})</label>
                    <input inputMode="decimal" value={d.monto_periodo} onChange={(e) => cambiar({ monto_periodo: e.target.value })} />
                  </div>
                </div>
                <div className="campo">
                  <label>Descripción</label>
                  <input value={d.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} placeholder="Ej. préstamo personal de marzo" />
                </div>
                {d.es_prestamo && (
                  <div className="fila-campos">
                    <div className="campo">
                      <label>Monto original del préstamo</label>
                      <input inputMode="decimal" value={d.monto_original} onChange={(e) => cambiar({ monto_original: e.target.value })} />
                    </div>
                    <div className="campo">
                      <label>Saldo pendiente a la fecha de vigencia</label>
                      <input inputMode="decimal" value={d.saldo_inicial} onChange={(e) => cambiar({ saldo_inicial: e.target.value })} />
                    </div>
                  </div>
                )}
                <button className="boton-fantasma" onClick={() => setB({ ...b, deducciones: b.deducciones.filter((_, j) => j !== k) })}>Quitar esta deducción</button>
              </div>
            )
          })}
          <button
            className="boton-fantasma"
            onClick={() => setB({
              ...b,
              deducciones: [...b.deducciones, {
                concepto_id: conceptosDeduccion[0]?.id ?? 'otra_deduccion', descripcion: '', monto_periodo: '',
                es_prestamo: conceptosDeduccion[0]?.id === 'prestamo_empleado', monto_original: '', saldo_inicial: '',
              }],
            })}
          >
            + Agregar deducción
          </button>
        </>
      )}

      <div className="fila-campos" style={{ marginTop: 18 }}>
        <div className="campo">
          <label htmlFor="pl-vig">Vigente desde</label>
          <input id="pl-vig" type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pl-motivo">Motivo (queda en la bitácora)</label>
          <input id="pl-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. ajuste anual aprobado por dirección" />
        </div>
      </div>

      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="boton-secundario" onClick={onCerrar} disabled={enviando}>Cancelar</button>
        <button className="boton-primario" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar a aprobación'}
        </button>
      </div>
    </Modal>
  )
}
