import { describe, expect, it } from 'vitest'
import { acumuladoEnAnio, calcularSaldo, diasBaseDelAnio } from '../acumulacion'
import type { Empleado, PoliticaAusencia, SolicitudAusencia } from '../types'

const empleadoBase: Empleado = {
  id: 'e1',
  nombre: 'Ana Prueba',
  email: 'ana@test.com',
  pais: 'NI',
  puesto: 'Analista',
  fechaIngreso: '2023-03-15',
  managerId: 'jefe1',
  rol: 'empleado',
  activo: true,
  avatarColor: '#888',
}

const politicaMensual: PoliticaAusencia = {
  id: 'p1',
  nombre: 'Vacaciones NI',
  pais: 'NI',
  tipoAusenciaId: 'vacaciones',
  metodoAcumulacion: 'mensual',
  diasPorAnio: 30,
  reglasAntiguedad: [],
  carryoverMaxDias: 10,
}

const politicaAnual: PoliticaAusencia = {
  id: 'p2',
  nombre: 'Vacaciones HN',
  pais: 'HN',
  tipoAusenciaId: 'vacaciones',
  metodoAcumulacion: 'anual',
  diasPorAnio: 15,
  reglasAntiguedad: [
    { aPartirDeAnios: 2, diasExtra: 2 },
    { aPartirDeAnios: 4, diasExtra: 5 },
  ],
}

function solicitudAprobada(medioDias: number, fechaInicio: string): SolicitudAusencia {
  return {
    id: `s-${fechaInicio}`,
    empleadoId: 'e1',
    tipoAusenciaId: 'vacaciones',
    fechaInicio,
    fechaFin: fechaInicio,
    fraccionInicio: 'completo',
    fraccionFin: 'completo',
    medioDias,
    estado: 'aprobada',
    creadaEn: `${fechaInicio}T08:00:00`,
  }
}

describe('diasBaseDelAnio — reglas de antigüedad', () => {
  it('sin tramo alcanzado usa la base', () => {
    // Ingresó 2023-03-15: al 1 ene 2024 tiene 0 años completos
    expect(diasBaseDelAnio(politicaAnual, empleadoBase, 2024)).toBe(15)
  })

  it('aplica el mayor tramo alcanzado, no la suma', () => {
    // Al 1 ene 2028 tiene 4 años: 15 + 5 (no 15+2+5)
    expect(diasBaseDelAnio(politicaAnual, empleadoBase, 2028)).toBe(20)
  })
})

describe('acumuladoEnAnio', () => {
  it('mensual: 30 días/año = 2.5 por mes completo', () => {
    // Enero–junio 2026 completos al 1 de julio = 6 meses = 15 días = 30 medios
    expect(acumuladoEnAnio(politicaMensual, empleadoBase, 2026, '2026-07-01')).toBe(30)
  })

  it('mensual: año de ingreso prorratea desde la fecha de ingreso', () => {
    // Ingresó 15-mar-2023; al 15-jun-2023 = 3 meses completos = 7.5 días = 15 medios
    expect(acumuladoEnAnio(politicaMensual, empleadoBase, 2023, '2023-06-15')).toBe(15)
  })

  it('anual: todo disponible desde el 1 de enero', () => {
    expect(acumuladoEnAnio(politicaAnual, empleadoBase, 2026, '2026-01-02')).toBe(34) // 17 días × 2
  })

  it('antes del ingreso no acumula nada', () => {
    expect(acumuladoEnAnio(politicaMensual, empleadoBase, 2022, '2022-12-31')).toBe(0)
  })
})

describe('calcularSaldo — el saldo se calcula, no se guarda', () => {
  it('acumulado − usado, con carryover limitado de años previos', () => {
    // 2025 completo: 30 días acumulados, usa 20 → quedan 10, carryover máx 10 → arrastra 10.
    // (2023–2024 también arrastran hasta 10 c/u, pero el tope de carryover limita a 10 por año.)
    const solicitudes = [solicitudAprobada(40, '2025-06-01')] // 20 días
    const saldo = calcularSaldo(politicaMensual, empleadoBase, '2026-07-01', solicitudes, [])
    // Carryover entra 2026 = 10 días (20 medios); acumulado ene–jun = 30 medios
    expect(saldo.carryoverMedios).toBe(20)
    expect(saldo.acumuladoMedios).toBe(30)
    expect(saldo.disponibleMedios).toBe(50)
  })

  it('los ajustes manuales del admin afectan el saldo', () => {
    const ajuste = {
      id: 'a1', empleadoId: 'e1', tipoAusenciaId: 'vacaciones',
      medioDias: 4, motivo: 'Compensación por trabajo en feriado', fecha: '2026-02-01', actorId: 'admin',
    }
    const conAjuste = calcularSaldo(politicaMensual, empleadoBase, '2026-07-01', [], [ajuste])
    const sinAjuste = calcularSaldo(politicaMensual, empleadoBase, '2026-07-01', [], [])
    expect(conAjuste.disponibleMedios - sinAjuste.disponibleMedios).toBe(4)
  })

  it('el carryover expira si no se usó antes de la fecha límite', () => {
    const politicaConExpiracion: PoliticaAusencia = {
      ...politicaMensual,
      carryoverExpira: { mes: 3, dia: 31 },
    }
    const antes = calcularSaldo(politicaConExpiracion, empleadoBase, '2026-03-01', [], [])
    const despues = calcularSaldo(politicaConExpiracion, empleadoBase, '2026-04-15', [], [])
    expect(antes.carryoverMedios).toBeGreaterThan(0)
    expect(despues.carryoverMedios).toBe(0)
  })

  it('las solicitudes pendientes se reportan aparte, sin descontar', () => {
    const pendiente: SolicitudAusencia = { ...solicitudAprobada(10, '2026-08-01'), estado: 'pendiente' }
    const saldo = calcularSaldo(politicaMensual, empleadoBase, '2026-07-01', [pendiente], [])
    expect(saldo.pendienteMedios).toBe(10)
    expect(saldo.usadoMedios).toBe(0)
  })
})
