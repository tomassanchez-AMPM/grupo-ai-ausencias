// Datos de ejemplo del prototipo: 4 países con reglas distintas para
// demostrar los tres ejes de customización del documento de diseño.

import type {
  AjusteSaldo,
  CorreoSaliente,
  Empleado,
  Feriado,
  Notificacion,
  Pais,
  PoliticaAusencia,
  RegistroAuditoria,
  SolicitudAusencia,
  TipoAusencia,
} from '../domain/types'

export const PAISES: Pais[] = [
  // Decisión de Tomás: el método de conteo es configurable por jurisdicción.
  { codigo: 'NI', nombre: 'Nicaragua', bandera: '🇳🇮', finDeSemana: [0, 6], metodoConteo: 'corridos_sin_feriados' },
  { codigo: 'HN', nombre: 'Honduras', bandera: '🇭🇳', finDeSemana: [0, 6], metodoConteo: 'laborables' },
  { codigo: 'SV', nombre: 'El Salvador', bandera: '🇸🇻', finDeSemana: [0, 6], metodoConteo: 'corridos' },
  { codigo: 'PA', nombre: 'Panamá', bandera: '🇵🇦', finDeSemana: [0, 6], metodoConteo: 'laborables' },
]

export const FERIADOS: Feriado[] = [
  // Nicaragua 2026
  { id: 'f-ni-1', pais: 'NI', fecha: '2026-01-01', descripcion: 'Año Nuevo' },
  { id: 'f-ni-2', pais: 'NI', fecha: '2026-04-02', descripcion: 'Jueves Santo' },
  { id: 'f-ni-3', pais: 'NI', fecha: '2026-04-03', descripcion: 'Viernes Santo' },
  { id: 'f-ni-4', pais: 'NI', fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
  { id: 'f-ni-5', pais: 'NI', fecha: '2026-07-19', descripcion: 'Día de la Revolución' },
  { id: 'f-ni-6', pais: 'NI', fecha: '2026-09-14', descripcion: 'Batalla de San Jacinto' },
  { id: 'f-ni-7', pais: 'NI', fecha: '2026-09-15', descripcion: 'Independencia' },
  { id: 'f-ni-8', pais: 'NI', fecha: '2026-12-08', descripcion: 'Inmaculada Concepción' },
  { id: 'f-ni-9', pais: 'NI', fecha: '2026-12-25', descripcion: 'Navidad' },
  // Honduras 2026
  { id: 'f-hn-1', pais: 'HN', fecha: '2026-01-01', descripcion: 'Año Nuevo' },
  { id: 'f-hn-2', pais: 'HN', fecha: '2026-04-02', descripcion: 'Jueves Santo' },
  { id: 'f-hn-3', pais: 'HN', fecha: '2026-04-03', descripcion: 'Viernes Santo' },
  { id: 'f-hn-4', pais: 'HN', fecha: '2026-04-14', descripcion: 'Día de las Américas' },
  { id: 'f-hn-5', pais: 'HN', fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
  { id: 'f-hn-6', pais: 'HN', fecha: '2026-09-15', descripcion: 'Independencia' },
  { id: 'f-hn-7', pais: 'HN', fecha: '2026-10-07', descripcion: 'Feriado Morazánico' },
  { id: 'f-hn-8', pais: 'HN', fecha: '2026-10-08', descripcion: 'Feriado Morazánico' },
  { id: 'f-hn-9', pais: 'HN', fecha: '2026-10-09', descripcion: 'Feriado Morazánico' },
  { id: 'f-hn-10', pais: 'HN', fecha: '2026-12-25', descripcion: 'Navidad' },
  // El Salvador 2026
  { id: 'f-sv-1', pais: 'SV', fecha: '2026-01-01', descripcion: 'Año Nuevo' },
  { id: 'f-sv-2', pais: 'SV', fecha: '2026-04-01', descripcion: 'Miércoles Santo' },
  { id: 'f-sv-3', pais: 'SV', fecha: '2026-04-02', descripcion: 'Jueves Santo' },
  { id: 'f-sv-4', pais: 'SV', fecha: '2026-04-03', descripcion: 'Viernes Santo' },
  { id: 'f-sv-5', pais: 'SV', fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
  { id: 'f-sv-6', pais: 'SV', fecha: '2026-08-03', descripcion: 'Fiestas Agostinas' },
  { id: 'f-sv-7', pais: 'SV', fecha: '2026-08-04', descripcion: 'Fiestas Agostinas' },
  { id: 'f-sv-8', pais: 'SV', fecha: '2026-08-05', descripcion: 'Fiestas Agostinas' },
  { id: 'f-sv-9', pais: 'SV', fecha: '2026-08-06', descripcion: 'Fiestas Agostinas' },
  { id: 'f-sv-10', pais: 'SV', fecha: '2026-09-15', descripcion: 'Independencia' },
  { id: 'f-sv-11', pais: 'SV', fecha: '2026-11-02', descripcion: 'Día de los Difuntos' },
  { id: 'f-sv-12', pais: 'SV', fecha: '2026-12-25', descripcion: 'Navidad' },
  // Panamá 2026
  { id: 'f-pa-1', pais: 'PA', fecha: '2026-01-01', descripcion: 'Año Nuevo' },
  { id: 'f-pa-2', pais: 'PA', fecha: '2026-01-09', descripcion: 'Día de los Mártires' },
  { id: 'f-pa-3', pais: 'PA', fecha: '2026-02-17', descripcion: 'Martes de Carnaval' },
  { id: 'f-pa-4', pais: 'PA', fecha: '2026-04-03', descripcion: 'Viernes Santo' },
  { id: 'f-pa-5', pais: 'PA', fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
  { id: 'f-pa-6', pais: 'PA', fecha: '2026-11-03', descripcion: 'Separación de Colombia' },
  { id: 'f-pa-7', pais: 'PA', fecha: '2026-11-10', descripcion: 'Primer Grito de Independencia' },
  { id: 'f-pa-8', pais: 'PA', fecha: '2026-11-28', descripcion: 'Independencia de España' },
  { id: 'f-pa-9', pais: 'PA', fecha: '2026-12-08', descripcion: 'Día de las Madres' },
  { id: 'f-pa-10', pais: 'PA', fecha: '2026-12-25', descripcion: 'Navidad' },
]

// Colores con contraste suficiente para texto blanco sobre fondo claro.
export const TIPOS_AUSENCIA: TipoAusencia[] = [
  { id: 'vacaciones', nombre: 'Vacaciones', descuentaSaldo: true, afectaNomina: false, requiereAdjunto: false, color: '#0E9F6E', icono: '🏖️' },
  { id: 'enfermedad', nombre: 'Enfermedad / incapacidad', descuentaSaldo: false, afectaNomina: false, requiereAdjunto: true, topeAnualDias: 15, color: '#D93025', icono: '🤒' },
  { id: 'permiso-personal', nombre: 'Permiso personal', descuentaSaldo: false, afectaNomina: false, requiereAdjunto: false, topeAnualDias: 3, color: '#3F6AD8', icono: '📋' },
  { id: 'sin-goce', nombre: 'Permiso sin goce de sueldo', descuentaSaldo: false, afectaNomina: true, requiereAdjunto: false, color: '#C27803', icono: '⏸️' },
  { id: 'licencia', nombre: 'Licencia (maternidad / luto)', descuentaSaldo: false, afectaNomina: false, requiereAdjunto: false, color: '#7E3AF2', icono: '🕊️' },
]

// Una política = país + tipo. Solo vacaciones acumula saldo en el MVP.
export const POLITICAS: PoliticaAusencia[] = [
  {
    id: 'pol-ni-vac', nombre: 'Vacaciones Nicaragua', pais: 'NI', tipoAusenciaId: 'vacaciones',
    metodoAcumulacion: 'mensual', diasPorAnio: 30, reglasAntiguedad: [],
    topeMultiplicador: 1.5, carryoverMaxDias: 15,
  },
  {
    id: 'pol-hn-vac', nombre: 'Vacaciones Honduras', pais: 'HN', tipoAusenciaId: 'vacaciones',
    metodoAcumulacion: 'anual', diasPorAnio: 10,
    reglasAntiguedad: [
      { aPartirDeAnios: 2, diasExtra: 2 },
      { aPartirDeAnios: 3, diasExtra: 5 },
      { aPartirDeAnios: 4, diasExtra: 10 },
    ],
    carryoverMaxDias: 5, carryoverExpira: { mes: 3, dia: 31 },
  },
  {
    id: 'pol-sv-vac', nombre: 'Vacaciones El Salvador', pais: 'SV', tipoAusenciaId: 'vacaciones',
    metodoAcumulacion: 'anual', diasPorAnio: 15, reglasAntiguedad: [], carryoverMaxDias: 0,
  },
  {
    id: 'pol-pa-vac', nombre: 'Vacaciones Panamá', pais: 'PA', tipoAusenciaId: 'vacaciones',
    metodoAcumulacion: 'mensual', diasPorAnio: 30, reglasAntiguedad: [], carryoverMaxDias: 10,
  },
]

const AVATARES = ['#7c5cff', '#14b8a6', '#f59e0b', '#ec4899', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c', '#22d3ee']

export const EMPLEADOS: Empleado[] = [
  { id: 'emp-pablo', nombre: 'Pablo Andrade', email: 'pablo@empresa.com', pais: 'NI', puesto: 'Director General', fechaIngreso: '2019-01-15', managerId: null, rol: 'jefe', activo: true, avatarColor: AVATARES[0] },
  { id: 'emp-tomas', nombre: 'Tomás Sánchez', email: 'tomas@empresa.com', pais: 'NI', puesto: 'CFO · RRHH', fechaIngreso: '2020-03-01', managerId: 'emp-pablo', rol: 'admin', activo: true, avatarColor: AVATARES[1] },
  { id: 'emp-carla', nombre: 'Carla Mendoza', email: 'carla@empresa.com', pais: 'HN', puesto: 'Gerente País Honduras', fechaIngreso: '2021-06-01', managerId: 'emp-pablo', rol: 'jefe', activo: true, avatarColor: AVATARES[2] },
  { id: 'emp-diego', nombre: 'Diego Paredes', email: 'diego@empresa.com', pais: 'SV', puesto: 'Gerente País El Salvador', fechaIngreso: '2022-02-14', managerId: 'emp-pablo', rol: 'jefe', activo: true, avatarColor: AVATARES[3] },
  { id: 'emp-maria', nombre: 'María López', email: 'maria@empresa.com', pais: 'NI', puesto: 'Contadora Senior', fechaIngreso: '2021-09-01', managerId: 'emp-tomas', rol: 'empleado', activo: true, avatarColor: AVATARES[4] },
  { id: 'emp-raul', nombre: 'Raúl Ortega', email: 'raul@empresa.com', pais: 'NI', puesto: 'Analista de Datos', fechaIngreso: '2024-01-08', managerId: 'emp-tomas', rol: 'empleado', activo: true, avatarColor: AVATARES[5] },
  { id: 'emp-jorge', nombre: 'Jorge Castillo', email: 'jorge@empresa.com', pais: 'HN', puesto: 'Analista Comercial', fechaIngreso: '2022-04-18', managerId: 'emp-carla', rol: 'empleado', activo: true, avatarColor: AVATARES[6] },
  { id: 'emp-lucia', nombre: 'Lucía Ramírez', email: 'lucia@empresa.com', pais: 'HN', puesto: 'Coordinadora de Logística', fechaIngreso: '2023-08-21', managerId: 'emp-carla', rol: 'empleado', activo: true, avatarColor: AVATARES[7] },
  { id: 'emp-andres', nombre: 'Andrés Flores', email: 'andres@empresa.com', pais: 'SV', puesto: 'Ejecutivo de Ventas', fechaIngreso: '2023-05-02', managerId: 'emp-diego', rol: 'empleado', activo: true, avatarColor: AVATARES[8] },
  { id: 'emp-sofia', nombre: 'Sofía Guzmán', email: 'sofia@empresa.com', pais: 'PA', puesto: 'Gerente de Marketing', fechaIngreso: '2022-11-07', managerId: 'emp-pablo', rol: 'empleado', activo: true, avatarColor: AVATARES[9] },
]

/** Admin designado: aprueba las solicitudes de quien no tiene jefe (sección 3.2). */
export const ADMIN_DESIGNADO_ID = 'emp-tomas'

// medioDias precalculados según el método de conteo de cada país.
// Las solicitudes multi-día terminan el día ANTERIOR al reintegro (modelo de
// reintegro): quien vuelve un lunes incluye el fin de semana si su país
// cuenta días corridos.
export const SOLICITUDES: SolicitudAusencia[] = [
  // Pendientes — pueblan las bandejas de aprobación
  {
    // HN laborables: 20–26 jul (reintegro lun 27) = 5 días hábiles.
    id: 'sol-1', empleadoId: 'emp-jorge', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-07-20', fechaFin: '2026-07-26', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 10, estado: 'pendiente', comentarioEmpleado: 'Viaje familiar planificado.',
    creadaEn: '2026-06-28T09:15:00',
  },
  {
    id: 'sol-2', empleadoId: 'emp-lucia', tipoAusenciaId: 'enfermedad',
    fechaInicio: '2026-07-03', fechaFin: '2026-07-03', fraccionInicio: 'tarde', fraccionFin: 'tarde',
    medioDias: 1, estado: 'pendiente', comentarioEmpleado: 'Cita médica de seguimiento.',
    adjuntoNombre: 'constancia-cita.pdf', creadaEn: '2026-07-01T14:30:00',
  },
  {
    // SV corridos: 10–16 ago (reintegro lun 17) = 7 días corridos.
    id: 'sol-3', empleadoId: 'emp-andres', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-08-10', fechaFin: '2026-08-16', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 14, estado: 'pendiente', comentarioEmpleado: 'Después de las agostinas.',
    creadaEn: '2026-06-30T11:00:00',
  },
  // Caso especial 3.2: el Director General no tiene jefe → aprueba el admin designado
  {
    // NI corridos sin feriados: 27 jul–2 ago (reintegro lun 3) = 7 días.
    id: 'sol-4', empleadoId: 'emp-pablo', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-07-27', fechaFin: '2026-08-02', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 14, estado: 'pendiente', comentarioEmpleado: 'Semana fuera; quedo disponible al teléfono.',
    creadaEn: '2026-07-01T08:00:00',
  },
  // Historial resuelto
  {
    // NI corridos sin feriados: 6–12 abr (reintegro lun 13) = 7 días.
    id: 'sol-5', empleadoId: 'emp-maria', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-04-06', fechaFin: '2026-04-12', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 14, estado: 'aprobada', aprobadorId: 'emp-tomas', resueltaEn: '2026-03-20T10:00:00',
    comentarioAprobador: 'Aprobado, ¡buen descanso!', creadaEn: '2026-03-18T16:45:00',
  },
  {
    // HN laborables: 16–22 mar (reintegro lun 23) = 5 días hábiles.
    id: 'sol-6', empleadoId: 'emp-carla', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-03-16', fechaFin: '2026-03-22', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 10, estado: 'aprobada', aprobadorId: 'emp-pablo', resueltaEn: '2026-03-02T09:30:00',
    creadaEn: '2026-03-01T12:00:00',
  },
  {
    id: 'sol-7', empleadoId: 'emp-jorge', tipoAusenciaId: 'enfermedad',
    fechaInicio: '2026-02-10', fechaFin: '2026-02-11', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 4, estado: 'aprobada', aprobadorId: 'emp-carla', resueltaEn: '2026-02-10T08:30:00',
    adjuntoNombre: 'incapacidad-ihss.pdf', creadaEn: '2026-02-10T07:50:00',
  },
  {
    id: 'sol-8', empleadoId: 'emp-sofia', tipoAusenciaId: 'permiso-personal',
    fechaInicio: '2026-06-15', fechaFin: '2026-06-15', fraccionInicio: 'completo', fraccionFin: 'completo',
    medioDias: 2, estado: 'rechazada', aprobadorId: 'emp-pablo', resueltaEn: '2026-06-12T15:00:00',
    comentarioAprobador: 'Coincide con el cierre de campaña; ¿lo movemos a la semana siguiente?',
    comentarioEmpleado: 'Trámite personal.', creadaEn: '2026-06-11T10:20:00',
  },
  {
    id: 'sol-9', empleadoId: 'emp-raul', tipoAusenciaId: 'vacaciones',
    fechaInicio: '2026-06-12', fechaFin: '2026-06-12', fraccionInicio: 'manana', fraccionFin: 'manana',
    medioDias: 1, estado: 'aprobada', aprobadorId: 'emp-tomas', resueltaEn: '2026-06-10T11:15:00',
    creadaEn: '2026-06-09T17:05:00',
  },
]

export const AJUSTES: AjusteSaldo[] = [
  {
    id: 'aj-1', empleadoId: 'emp-maria', tipoAusenciaId: 'vacaciones', medioDias: 4,
    motivo: 'Compensación por trabajo en feriado (Semana Santa)', fecha: '2026-04-15', actorId: 'emp-tomas',
  },
]

export const AUDITORIA: RegistroAuditoria[] = [
  { id: 'aud-1', actorId: 'emp-tomas', accion: 'aprobó', entidad: 'solicitud', entidadId: 'sol-5', detalle: 'Vacaciones de María López (7 días, reintegro 13-abr) — política Vacaciones Nicaragua v1', timestamp: '2026-03-20T10:00:00' },
  { id: 'aud-2', actorId: 'emp-pablo', accion: 'rechazó', entidad: 'solicitud', entidadId: 'sol-8', detalle: 'Permiso personal de Sofía Guzmán — coincide con cierre de campaña', timestamp: '2026-06-12T15:00:00' },
  { id: 'aud-3', actorId: 'emp-tomas', accion: 'ajustó saldo', entidad: 'ajuste', entidadId: 'aj-1', detalle: '+2 días de vacaciones a María López — compensación por feriado trabajado', timestamp: '2026-04-15T09:00:00' },
]

export const NOTIFICACIONES: Notificacion[] = [
  { id: 'not-1', paraId: 'emp-carla', mensaje: 'Jorge Castillo solicitó Vacaciones desde el 20 de julio, reintegro el 27 de julio (5 días).', leida: false, timestamp: '2026-06-28T09:15:00', solicitudId: 'sol-1' },
  { id: 'not-2', paraId: 'emp-carla', mensaje: 'Lucía Ramírez solicitó Enfermedad para el 3 de julio por la tarde (0.5 días).', leida: false, timestamp: '2026-07-01T14:30:00', solicitudId: 'sol-2' },
  { id: 'not-3', paraId: 'emp-diego', mensaje: 'Andrés Flores solicitó Vacaciones desde el 10 de agosto, reintegro el 17 de agosto (7 días).', leida: false, timestamp: '2026-06-30T11:00:00', solicitudId: 'sol-3' },
  { id: 'not-4', paraId: 'emp-tomas', mensaje: 'Pablo Andrade solicitó Vacaciones desde el 27 de julio, reintegro el 3 de agosto (7 días). Eres su aprobador designado.', leida: false, timestamp: '2026-07-01T08:00:00', solicitudId: 'sol-4' },
]

export const CORREOS: CorreoSaliente[] = [
  { id: 'mail-1', para: 'carla@empresa.com', asunto: 'Nueva solicitud de ausencia — Jorge Castillo', cuerpo: 'Jorge Castillo solicitó Vacaciones desde el 20 de julio, reintegro el 27 de julio (5 días). Ingresa a la plataforma para aprobar o rechazar.', timestamp: '2026-06-28T09:15:00' },
  { id: 'mail-2', para: 'tomas@empresa.com', asunto: 'Nueva solicitud de ausencia — Pablo Andrade', cuerpo: 'Pablo Andrade solicitó Vacaciones desde el 27 de julio, reintegro el 3 de agosto (7 días). Eres su aprobador designado.', timestamp: '2026-07-01T08:00:00' },
]
