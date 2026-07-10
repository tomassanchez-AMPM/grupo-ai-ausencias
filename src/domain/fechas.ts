// Utilidades de fecha en zona local. Las fechas de negocio viajan como
// 'YYYY-MM-DD' para evitar sorpresas de zona horaria con Date/ISO.

export function parseFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatearISO(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diaSiguiente(iso: string): string {
  const fecha = parseFecha(iso)
  fecha.setDate(fecha.getDate() + 1)
  return formatearISO(fecha)
}

export function diaAnterior(iso: string): string {
  const fecha = parseFecha(iso)
  fecha.setDate(fecha.getDate() - 1)
  return formatearISO(fecha)
}

export function cadaDia(inicio: string, fin: string): string[] {
  const dias: string[] = []
  const cursor = parseFecha(inicio)
  const limite = parseFecha(fin)
  while (cursor <= limite) {
    dias.push(formatearISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

export function aniosDeServicio(fechaIngreso: string, hasta: string): number {
  const ingreso = parseFecha(fechaIngreso)
  const fecha = parseFecha(hasta)
  let anios = fecha.getFullYear() - ingreso.getFullYear()
  const cumpleEsteAnio = new Date(fecha.getFullYear(), ingreso.getMonth(), ingreso.getDate())
  if (fecha < cumpleEsteAnio) anios -= 1
  return Math.max(0, anios)
}

/** Meses completos transcurridos entre dos fechas (para prorrateo mensual). */
export function mesesCompletos(desde: string, hasta: string): number {
  const inicio = parseFecha(desde)
  const fin = parseFecha(hasta)
  if (fin <= inicio) return 0
  let meses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth())
  if (fin.getDate() < inicio.getDate()) meses -= 1
  return Math.max(0, meses)
}

export function formatearLargo(iso: string): string {
  return parseFecha(iso).toLocaleDateString('es-NI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatearCorto(iso: string): string {
  return parseFecha(iso).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' })
}
