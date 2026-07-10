import { describe, expect, it } from 'vitest'
import { contarMedioDias, formatearDias, rangoDesdeReintegro, reintegroDe } from '../conteoDias'
import type { Feriado, Pais } from '../types'

const nicaragua: Pais = {
  codigo: 'NI',
  nombre: 'Nicaragua',
  bandera: '🇳🇮',
  finDeSemana: [0, 6],
  metodoConteo: 'corridos_sin_feriados',
}

const honduras: Pais = {
  codigo: 'HN',
  nombre: 'Honduras',
  bandera: '🇭🇳',
  finDeSemana: [0, 6],
  metodoConteo: 'laborables',
}

// Lunes 2026-07-06 … domingo 2026-07-12. Feriado el jueves 9 en ambos países.
const feriados: Feriado[] = [
  { id: 'f1', pais: 'NI', fecha: '2026-07-09', descripcion: 'Feriado de prueba' },
  { id: 'f2', pais: 'HN', fecha: '2026-07-09', descripcion: 'Feriado de prueba' },
]

const semanaCompleta = {
  fechaInicio: '2026-07-06',
  fechaFin: '2026-07-12',
  fraccionInicio: 'completo' as const,
  fraccionFin: 'completo' as const,
}

describe('contarMedioDias — método por país', () => {
  it('Nicaragua (corridos sin feriados): cuenta fin de semana, salta feriado', () => {
    // 7 días − 1 feriado = 6 días = 12 medios
    expect(contarMedioDias(semanaCompleta, nicaragua, feriados)).toBe(12)
  })

  it('Honduras (laborables): salta fin de semana y feriado', () => {
    // lun,mar,mié,vie = 4 días = 8 medios
    expect(contarMedioDias(semanaCompleta, honduras, feriados)).toBe(8)
  })

  it('método corridos: cuenta absolutamente todo', () => {
    const paisCorrido: Pais = { ...nicaragua, metodoConteo: 'corridos' }
    expect(contarMedioDias(semanaCompleta, paisCorrido, feriados)).toBe(14)
  })
})

describe('contarMedioDias — medio día (sección 5.3)', () => {
  it('un solo día completo = 2 medios', () => {
    const dia = { fechaInicio: '2026-07-06', fechaFin: '2026-07-06', fraccionInicio: 'completo' as const, fraccionFin: 'completo' as const }
    expect(contarMedioDias(dia, honduras, [])).toBe(2)
  })

  it('un solo día por la mañana = 1 medio', () => {
    const dia = { fechaInicio: '2026-07-06', fechaFin: '2026-07-06', fraccionInicio: 'manana' as const, fraccionFin: 'manana' as const }
    expect(contarMedioDias(dia, honduras, [])).toBe(1)
  })

  it('rango que empieza por la tarde y termina al mediodía', () => {
    // lun tarde (1) + mar (2) + mié mañana (1) = 4 medios = 2 días
    const rango = { fechaInicio: '2026-07-06', fechaFin: '2026-07-08', fraccionInicio: 'tarde' as const, fraccionFin: 'manana' as const }
    expect(contarMedioDias(rango, honduras, [])).toBe(4)
  })

  it('la fracción no aplica si el día de inicio no cuenta (feriado)', () => {
    // jueves 9 feriado tarde + viernes 10 completo = 2 medios (solo viernes)
    const rango = { fechaInicio: '2026-07-09', fechaFin: '2026-07-10', fraccionInicio: 'tarde' as const, fraccionFin: 'completo' as const }
    expect(contarMedioDias(rango, honduras, feriados)).toBe(2)
  })

  it('solicitud enteramente en fin de semana en país laborable = 0', () => {
    const finde = { fechaInicio: '2026-07-11', fechaFin: '2026-07-12', fraccionInicio: 'completo' as const, fraccionFin: 'completo' as const }
    expect(contarMedioDias(finde, honduras, [])).toBe(0)
  })
})

describe('rangoDesdeReintegro — el reintegro define la ausencia', () => {
  it('reintegro lunes en país de días corridos incluye el fin de semana', () => {
    // Caso de Tomás: sale el lunes 6 jul y se reintegra el lunes 13 jul.
    // NI (corridos sin feriados): 6..12 jul = 7 días, con sábado y domingo.
    const rango = rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-13', reintegroMediodia: false,
    })
    expect(rango).toEqual({
      fechaInicio: '2026-07-06', fechaFin: '2026-07-12',
      fraccionInicio: 'completo', fraccionFin: 'completo',
    })
    expect(contarMedioDias(rango!, nicaragua, [])).toBe(14) // 7 días
  })

  it('mismo reintegro lunes en país laborable descuenta solo 5', () => {
    const rango = rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-13', reintegroMediodia: false,
    })
    expect(contarMedioDias(rango!, honduras, [])).toBe(10) // lun–vie
  })

  it('el feriado dentro del rango sigue sin contarse (NI: corridos SIN feriados)', () => {
    // 13 jul → reintegro 20 jul con feriado el 19: 7 días corridos − 1 feriado = 6.
    const feriado: Feriado[] = [{ id: 'f', pais: 'NI', fecha: '2026-07-19', descripcion: 'Día de la Revolución' }]
    const rango = rangoDesdeReintegro({
      fechaInicio: '2026-07-13', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-20', reintegroMediodia: false,
    })
    expect(contarMedioDias(rango!, nicaragua, feriado)).toBe(12) // 6 días
  })

  it('reintegro al mediodía incluye la mañana de ese día', () => {
    const rango = rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-08', reintegroMediodia: true,
    })
    // lun (2) + mar (2) + mié mañana (1) = 5 medios = 2.5 días
    expect(contarMedioDias(rango!, honduras, [])).toBe(5)
  })

  it('ausencia de una mañana: sale y se reintegra el mismo día al mediodía', () => {
    const rango = rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-06', reintegroMediodia: true,
    })
    expect(contarMedioDias(rango!, honduras, [])).toBe(1)
  })

  it('rechaza reintegros imposibles', () => {
    // Reintegro el mismo día de la salida (sin mediodía) = ausencia vacía.
    expect(rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-06', reintegroMediodia: false,
    })).toBeNull()
    // Reintegro anterior a la salida.
    expect(rangoDesdeReintegro({
      fechaInicio: '2026-07-06', fraccionInicio: 'completo',
      fechaReintegro: '2026-07-03', reintegroMediodia: false,
    })).toBeNull()
  })

  it('reintegroDe reconstruye la fecha de reintegro desde el rango guardado', () => {
    expect(reintegroDe({ fechaFin: '2026-07-12', fraccionFin: 'completo' })).toEqual({ fecha: '2026-07-13', mediodia: false })
    expect(reintegroDe({ fechaFin: '2026-07-08', fraccionFin: 'manana' })).toEqual({ fecha: '2026-07-08', mediodia: true })
  })
})

describe('formatearDias', () => {
  it('formatea enteros y medios', () => {
    expect(formatearDias(12)).toBe('6 días')
    expect(formatearDias(5)).toBe('2.5 días')
    expect(formatearDias(2)).toBe('1 día')
  })
})
