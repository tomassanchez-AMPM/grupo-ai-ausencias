// Conteo de días descontables de una solicitud — configurable por país.
// Este es uno de los tres ejes de customización (sección 5.3 + decisión de Tomás):
//   NI → corridos_sin_feriados: cuenta fines de semana, excluye feriados.
//   HN → laborables: excluye fines de semana y feriados.
// La unidad interna es el MEDIO DÍA (sección 5.3).

import type { Feriado, Fraccion, Pais } from './types'
import { cadaDia, diaAnterior, diaSiguiente, parseFecha } from './fechas'

function esFinDeSemana(fechaISO: string, pais: Pais): boolean {
  return pais.finDeSemana.includes(parseFecha(fechaISO).getDay())
}

function esFeriado(fechaISO: string, pais: Pais, feriados: Feriado[]): boolean {
  return feriados.some((f) => f.pais === pais.codigo && f.fecha === fechaISO)
}

/** ¿Este día descuenta saldo según el método del país? */
export function diaCuenta(fechaISO: string, pais: Pais, feriados: Feriado[]): boolean {
  switch (pais.metodoConteo) {
    case 'laborables':
      return !esFinDeSemana(fechaISO, pais) && !esFeriado(fechaISO, pais, feriados)
    case 'corridos_sin_feriados':
      return !esFeriado(fechaISO, pais, feriados)
    case 'corridos':
      return true
  }
}

export interface RangoSolicitud {
  fechaInicio: string
  fechaFin: string
  fraccionInicio: Fraccion
  fraccionFin: Fraccion
}

/**
 * Medios días que descuenta una solicitud.
 * Convención de fracciones:
 *  - Un solo día: manda fraccionInicio ('manana' o 'tarde' = 1 medio día).
 *  - Varios días: fraccionInicio 'tarde' = empieza por la tarde (½ el primer día);
 *    fraccionFin 'manana' = termina al mediodía (½ el último día).
 */
export function contarMedioDias(rango: RangoSolicitud, pais: Pais, feriados: Feriado[]): number {
  const dias = cadaDia(rango.fechaInicio, rango.fechaFin)
  const unSoloDia = rango.fechaInicio === rango.fechaFin
  let medios = 0

  for (const dia of dias) {
    if (!diaCuenta(dia, pais, feriados)) continue

    if (unSoloDia) {
      medios += rango.fraccionInicio === 'completo' ? 2 : 1
      continue
    }

    let mediosDelDia = 2
    if (dia === rango.fechaInicio && rango.fraccionInicio === 'tarde') mediosDelDia = 1
    if (dia === rango.fechaFin && rango.fraccionFin === 'manana') mediosDelDia = 1
    medios += mediosDelDia
  }

  return medios
}

/**
 * El empleado declara su PRIMER DÍA de ausencia y su FECHA DE REINTEGRO
 * (primer día en que vuelve a trabajar); la ausencia cubre hasta el día
 * anterior al reintegro. Así, quien se reintegra un lunes incluye el fin
 * de semana en su ausencia — regla clave en países de días corridos (NI).
 */
export interface EntradaReintegro {
  fechaInicio: string
  /** 'completo' = ausente todo el primer día; 'tarde' = trabaja la mañana. */
  fraccionInicio: Fraccion
  fechaReintegro: string
  /** true = se reintegra al mediodía: la mañana del reintegro también cuenta. */
  reintegroMediodia: boolean
}

/** Convierte inicio + reintegro al rango interno. null si el rango es inválido. */
export function rangoDesdeReintegro(entrada: EntradaReintegro): RangoSolicitud | null {
  const { fechaInicio, fraccionInicio, fechaReintegro, reintegroMediodia } = entrada

  if (reintegroMediodia) {
    // La ausencia incluye la mañana del día de reintegro.
    if (parseFecha(fechaReintegro) < parseFecha(fechaInicio)) return null
    if (fechaReintegro === fechaInicio) {
      // Ausente solo la mañana y vuelve al mediodía del mismo día.
      if (fraccionInicio === 'tarde') return null
      return { fechaInicio, fechaFin: fechaReintegro, fraccionInicio: 'manana', fraccionFin: 'manana' }
    }
    return { fechaInicio, fechaFin: fechaReintegro, fraccionInicio, fraccionFin: 'manana' }
  }

  const fechaFin = diaAnterior(fechaReintegro)
  if (parseFecha(fechaFin) < parseFecha(fechaInicio)) return null
  return { fechaInicio, fechaFin, fraccionInicio, fraccionFin: 'completo' }
}

/** Fecha (y hora del día) en que la persona vuelve a trabajar, derivada del rango. */
export function reintegroDe(rango: Pick<RangoSolicitud, 'fechaFin' | 'fraccionFin'>): {
  fecha: string
  mediodia: boolean
} {
  return rango.fraccionFin === 'manana'
    ? { fecha: rango.fechaFin, mediodia: true }
    : { fecha: diaSiguiente(rango.fechaFin), mediodia: false }
}

/** Formatea medios días como días legibles: 5 → "2.5 días". */
export function formatearDias(medioDias: number): string {
  const dias = medioDias / 2
  const texto = Number.isInteger(dias) ? String(dias) : dias.toFixed(1)
  return `${texto} ${dias === 1 ? 'día' : 'días'}`
}
