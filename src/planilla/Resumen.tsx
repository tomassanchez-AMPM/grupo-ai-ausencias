// Presentación de solo lectura de cada sección de una ficha. Se usa en la
// lista, en el detalle y para comparar «vigente → propuesto» en las solicitudes.

import type {
  Catalogos, DatosCuenta, DatosGenerales, ItemClase, ItemCompensacion, ItemDeduccion, ItemPagador, Seccion,
} from './tipos'

const formatoMonto = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function dinero(monto: number | string | null | undefined, moneda: string): string {
  if (monto == null || monto === '') return '—'
  return `${moneda} ${formatoMonto.format(Number(monto))}`
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const FRECUENCIA: Record<string, string> = { mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal' }
const ESTADO: Record<string, string> = { activa: 'Activa', suspendida: 'Suspendida', baja: 'Baja' }

export function ResumenSeccion({ seccion, datos, catalogos }: { seccion: Seccion; datos: unknown; catalogos: Catalogos }) {
  if (datos == null) return <span className="meta">Sin registro</span>

  if (seccion === 'general') {
    const g = datos as DatosGenerales
    const pais = catalogos.legislaciones.find((l) => l.codigo === g.legislacion)?.nombre ?? g.legislacion
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        <li>Legislación: <strong>{pais}</strong></li>
        <li>Frecuencia de pago: <strong>{FRECUENCIA[g.frecuencia_pago] ?? g.frecuencia_pago}</strong> · Moneda: <strong>{g.moneda}</strong></li>
        <li>Ingreso original: <strong>{fecha(g.fecha_ingreso_original)}</strong> · Última liquidación: <strong>{fecha(g.fecha_ultima_liquidacion)}</strong></li>
        {g.estado && <li>Estado: <strong>{ESTADO[g.estado] ?? g.estado}</strong></li>}
      </ul>
    )
  }

  if (seccion === 'compensacion') {
    const items = datos as ItemCompensacion[]
    if (items.length === 0) return <span className="meta">Sin compensación vigente</span>
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        {items.map((i, k) => {
          const nombre = i.concepto ?? catalogos.conceptos.find((c) => c.id === i.concepto_id)?.nombre ?? i.concepto_id
          return <li key={k}>{nombre}{i.descripcion ? ` (${i.descripcion})` : ''}: <strong>{dinero(i.monto, i.moneda)}</strong></li>
        })}
      </ul>
    )
  }

  if (seccion === 'pagadores') {
    const items = datos as ItemPagador[]
    if (items.length === 0) return <span className="meta">Sin empresa pagadora</span>
    return (
      <span style={{ fontSize: 14 }}>
        {items.map((i) => `${i.empresa ?? catalogos.empresas.find((e) => e.id === i.empresa_id)?.nombre ?? i.empresa_id} ${Number(i.porcentaje)} %`).join(' · ')}
      </span>
    )
  }

  if (seccion === 'clases') {
    const items = datos as ItemClase[]
    if (items.length === 0) return <span className="meta">Sin clase asignada</span>
    return (
      <span style={{ fontSize: 14 }}>
        {items.map((i) => `${i.clase ?? catalogos.clases.find((c) => c.id === i.clase_id)?.nombre ?? '—'} ${Number(i.porcentaje)} %`).join(' · ')}
      </span>
    )
  }

  if (seccion === 'cuenta') {
    const c = datos as DatosCuenta
    const banco = c.banco ?? catalogos.bancos.find((b) => b.id === c.banco_id)?.nombre ?? '—'
    return (
      <span style={{ fontSize: 14 }}>
        {banco} · {c.tipo_cuenta === 'ahorro' ? 'Ahorro' : 'Corriente'} · {c.moneda} · {c.titular} · <strong>••••{c.ultimos4 ?? '????'}</strong>
      </span>
    )
  }

  const items = datos as ItemDeduccion[]
  if (items.length === 0) return <span className="meta">Sin deducciones</span>
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
      {items.map((d, k) => {
        const nombre = d.concepto ?? catalogos.conceptos.find((c) => c.id === d.concepto_id)?.nombre ?? d.concepto_id
        return (
          <li key={k}>
            {nombre}{d.descripcion ? ` (${d.descripcion})` : ''}: <strong>{dinero(d.monto_periodo, d.moneda)}</strong> por período
            {d.es_prestamo && <> · préstamo de {dinero(d.monto_original, d.moneda)}, saldo {dinero(d.saldo_inicial, d.moneda)}</>}
          </li>
        )
      })}
    </ul>
  )
}
