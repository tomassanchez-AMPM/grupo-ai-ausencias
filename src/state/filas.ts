// Mapeo entre las filas snake_case de Postgres y los tipos del dominio.
// Mantiene al resto de la app ajena al esquema físico.

import type {
  AjusteSaldo,
  Compensacion,
  Empleado,
  Feriado,
  Notificacion,
  Pais,
  PoliticaAusencia,
  RegistroAuditoria,
  SolicitudAusencia,
  TipoAusencia,
} from '../domain/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function aPais(fila: any): Pais {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    bandera: fila.bandera,
    finDeSemana: fila.fin_de_semana,
    metodoConteo: fila.metodo_conteo,
  }
}

export function aTipoAusencia(fila: any): TipoAusencia {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descuentaSaldo: fila.descuenta_saldo,
    afectaNomina: fila.afecta_nomina,
    requiereAdjunto: fila.requiere_adjunto,
    topeAnualDias: fila.tope_anual_dias ?? undefined,
    color: fila.color,
    icono: fila.icono,
  }
}

export function aPolitica(fila: any): PoliticaAusencia {
  return {
    id: fila.id,
    nombre: fila.nombre,
    pais: fila.pais,
    tipoAusenciaId: fila.tipo_ausencia_id,
    metodoAcumulacion: fila.metodo_acumulacion,
    diasPorAnio: Number(fila.dias_por_anio),
    reglasAntiguedad: fila.reglas_antiguedad ?? [],
    topeMultiplicador: fila.tope_multiplicador != null ? Number(fila.tope_multiplicador) : undefined,
    carryoverMaxDias: fila.carryover_max_dias != null ? Number(fila.carryover_max_dias) : undefined,
    carryoverExpira: fila.carryover_expira ?? undefined,
  }
}

export function aFeriado(fila: any): Feriado {
  return {
    id: fila.id,
    pais: fila.pais,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    medioDia: fila.medio_dia ?? false,
  }
}

export function aEmpleado(fila: any): Empleado {
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    pais: fila.pais,
    puesto: fila.puesto,
    fechaIngreso: fila.fecha_ingreso,
    managerId: fila.manager_id,
    rol: fila.rol,
    activo: fila.activo,
    avatarColor: fila.avatar_color,
  }
}

export function aSolicitud(fila: any): SolicitudAusencia {
  return {
    id: fila.id,
    empleadoId: fila.empleado_id,
    tipoAusenciaId: fila.tipo_ausencia_id,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    fraccionInicio: fila.fraccion_inicio,
    fraccionFin: fila.fraccion_fin,
    medioDias: fila.medio_dias,
    estado: fila.estado,
    comentarioEmpleado: fila.comentario_empleado ?? undefined,
    comentarioAprobador: fila.comentario_aprobador ?? undefined,
    adjuntoNombre: fila.adjunto_url ?? undefined,
    aprobadorId: fila.aprobador_id ?? undefined,
    creadaEn: fila.creada_en,
    resueltaEn: fila.resuelta_en ?? undefined,
  }
}

export function aAjuste(fila: any): AjusteSaldo {
  return {
    id: fila.id,
    empleadoId: fila.empleado_id,
    tipoAusenciaId: fila.tipo_ausencia_id,
    medioDias: fila.medio_dias,
    motivo: fila.motivo,
    fecha: fila.fecha,
    actorId: fila.actor_id,
  }
}

export function aCompensacion(fila: any): Compensacion {
  return {
    id: fila.id,
    empleadoId: fila.empleado_id,
    fechaEfectiva: fila.fecha_efectiva,
    moneda: fila.moneda,
    montoBase: Number(fila.monto_base),
    motivo: fila.motivo,
  }
}

export function aAuditoria(fila: any): RegistroAuditoria {
  return {
    id: fila.id,
    actorId: fila.actor_id ?? '',
    accion: fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    detalle: fila.detalle,
    timestamp: fila.timestamp,
  }
}

export function aNotificacion(fila: any): Notificacion {
  return {
    id: fila.id,
    paraId: fila.para_id,
    mensaje: fila.mensaje,
    leida: fila.leida,
    timestamp: fila.timestamp,
    solicitudId: fila.solicitud_id ?? undefined,
  }
}
