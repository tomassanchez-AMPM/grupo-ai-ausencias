// Motor de acumulación — el diferenciador #1 (sección 5.1).
// El saldo SE CALCULA, no se guarda (sección 4.3):
//   Saldo = Acumulado(política, antigüedad, fecha) − Σ ausencias aprobadas que
//           descuentan saldo + ajustes manuales, con carryover y tope.
// Todo en MEDIOS DÍAS internamente.

import type {
  AjusteSaldo,
  Empleado,
  PoliticaAusencia,
  SolicitudAusencia,
} from './types'
import { aniosDeServicio, mesesCompletos, parseFecha } from './fechas'

/** Días base del año según antigüedad (aplica el mayor tramo alcanzado). */
export function diasBaseDelAnio(politica: PoliticaAusencia, empleado: Empleado, anio: number): number {
  const referencia = `${anio}-01-01`
  const anios = aniosDeServicio(empleado.fechaIngreso, referencia)
  let extra = 0
  for (const regla of politica.reglasAntiguedad) {
    if (anios >= regla.aPartirDeAnios) extra = Math.max(extra, regla.diasExtra)
  }
  return politica.diasPorAnio + extra
}

/** Medios días acumulados dentro de un año, hasta una fecha dada. */
export function acumuladoEnAnio(
  politica: PoliticaAusencia,
  empleado: Empleado,
  anio: number,
  hastaISO: string,
): number {
  const ingreso = parseFecha(empleado.fechaIngreso)
  const inicioAnio = new Date(anio, 0, 1)
  const finPeriodo = parseFecha(hastaISO)
  if (finPeriodo < inicioAnio) return 0
  if (ingreso.getFullYear() > anio) return 0

  const base = diasBaseDelAnio(politica, empleado, anio)
  const desde = ingreso > inicioAnio ? empleado.fechaIngreso : `${anio}-01-01`
  const hasta = finPeriodo.getFullYear() > anio ? `${anio}-12-31` : hastaISO

  switch (politica.metodoAcumulacion) {
    case 'anual': {
      // Todo de golpe el 1 de enero; quien ingresa a mitad de año recibe
      // el proporcional de los meses restantes desde su ingreso.
      if (ingreso <= inicioAnio) return base * 2
      const mesesRestantes = 12 - ingreso.getMonth()
      return Math.round(((base * mesesRestantes) / 12) * 2)
    }
    case 'mensual': {
      const meses = Math.min(mesesCompletos(desde, hasta), 12)
      return Math.round(((base * meses) / 12) * 2)
    }
    case 'quincenal': {
      // Aproximación de prorrateo quincenal: 24 periodos por año.
      const quincenas = Math.min(Math.floor((mesesCompletos(desde, hasta) * 30) / 15), 24)
      return Math.round(((base * quincenas) / 24) * 2)
    }
  }
}

function usadoEnAnio(
  solicitudes: SolicitudAusencia[],
  empleadoId: string,
  tipoAusenciaId: string,
  anio: number,
): number {
  return solicitudes
    .filter(
      (s) =>
        s.empleadoId === empleadoId &&
        s.tipoAusenciaId === tipoAusenciaId &&
        s.estado === 'aprobada' &&
        parseFecha(s.fechaInicio).getFullYear() === anio,
    )
    .reduce((total, s) => total + s.medioDias, 0)
}

function ajustadoEnAnio(
  ajustes: AjusteSaldo[],
  empleadoId: string,
  tipoAusenciaId: string,
  anio: number,
): number {
  return ajustes
    .filter(
      (a) =>
        a.empleadoId === empleadoId &&
        a.tipoAusenciaId === tipoAusenciaId &&
        parseFecha(a.fecha).getFullYear() === anio,
    )
    .reduce((total, a) => total + a.medioDias, 0)
}

export interface DetalleSaldo {
  acumuladoMedios: number
  carryoverMedios: number
  usadoMedios: number
  ajustesMedios: number
  disponibleMedios: number
  pendienteMedios: number // solicitudes pendientes que descontarían
}

/**
 * Saldo disponible a una fecha, recorriendo año por año desde el ingreso
 * para arrastrar el carryover con su tope y expiración.
 * Simplificación de prototipo: el uso de cada año consume primero el
 * carryover; si a la fecha de expiración quedaba carryover sin usar, se pierde.
 */
export function calcularSaldo(
  politica: PoliticaAusencia,
  empleado: Empleado,
  fechaISO: string,
  solicitudes: SolicitudAusencia[],
  ajustes: AjusteSaldo[],
): DetalleSaldo {
  const anioIngreso = parseFecha(empleado.fechaIngreso).getFullYear()
  const anioActual = parseFecha(fechaISO).getFullYear()
  let carryover = 0

  for (let anio = anioIngreso; anio < anioActual; anio++) {
    const acumulado = acumuladoEnAnio(politica, empleado, anio, `${anio}-12-31`)
    const usado = usadoEnAnio(solicitudes, empleado.id, politica.tipoAusenciaId, anio)
    const ajustado = ajustadoEnAnio(ajustes, empleado.id, politica.tipoAusenciaId, anio)
    let saldoFin = carryover + acumulado + ajustado - usado

    if (politica.topeMultiplicador != null) {
      const base = diasBaseDelAnio(politica, empleado, anio)
      saldoFin = Math.min(saldoFin, Math.round(base * politica.topeMultiplicador * 2))
    }
    carryover =
      politica.carryoverMaxDias != null
        ? Math.min(Math.max(saldoFin, 0), politica.carryoverMaxDias * 2)
        : Math.max(saldoFin, 0)
  }

  // Expiración del carryover en el año en curso.
  if (carryover > 0 && politica.carryoverExpira) {
    const { mes, dia } = politica.carryoverExpira
    const expiracion = new Date(anioActual, mes - 1, dia)
    if (parseFecha(fechaISO) > expiracion) {
      const usadoAntes = solicitudes
        .filter(
          (s) =>
            s.empleadoId === empleado.id &&
            s.tipoAusenciaId === politica.tipoAusenciaId &&
            s.estado === 'aprobada' &&
            parseFecha(s.fechaInicio).getFullYear() === anioActual &&
            parseFecha(s.fechaInicio) <= expiracion,
        )
        .reduce((t, s) => t + s.medioDias, 0)
      carryover = Math.min(carryover, usadoAntes)
    }
  }

  const acumulado = acumuladoEnAnio(politica, empleado, anioActual, fechaISO)
  const usado = usadoEnAnio(solicitudes, empleado.id, politica.tipoAusenciaId, anioActual)
  const ajustado = ajustadoEnAnio(ajustes, empleado.id, politica.tipoAusenciaId, anioActual)
  const pendiente = solicitudes
    .filter(
      (s) =>
        s.empleadoId === empleado.id &&
        s.tipoAusenciaId === politica.tipoAusenciaId &&
        s.estado === 'pendiente',
    )
    .reduce((t, s) => t + s.medioDias, 0)

  let disponible = carryover + acumulado + ajustado - usado
  if (politica.topeMultiplicador != null) {
    const base = diasBaseDelAnio(politica, empleado, anioActual)
    disponible = Math.min(disponible, Math.round(base * politica.topeMultiplicador * 2))
  }

  return {
    acumuladoMedios: acumulado,
    carryoverMedios: carryover,
    usadoMedios: usado,
    ajustesMedios: ajustado,
    disponibleMedios: disponible,
    pendienteMedios: pendiente,
  }
}
