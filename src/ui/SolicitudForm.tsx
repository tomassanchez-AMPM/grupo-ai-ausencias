// Formulario de solicitud de ausencia (paso 1 del flujo fijo, sección 5.4).
// El empleado declara su primer día de ausencia y su FECHA DE REINTEGRO
// (decisión de Tomás): reintegrarse el lunes incluye el fin de semana en
// países de días corridos. Previsualiza en vivo el descuento según el país.

import { useMemo, useState } from 'react'
import {
  contarMedioDias,
  formatearDias,
  rangoDesdeReintegro,
} from '../domain/conteoDias'
import { diaSiguiente, formatearISO, formatearLargo } from '../domain/fechas'
import type { Empleado, Fraccion } from '../domain/types'
import { useStore } from '../state/store'
import { Modal } from './comunes'

const ETIQUETA_CONTEO: Record<string, string> = {
  laborables: 'solo días laborables',
  corridos_sin_feriados: 'días corridos, sin contar feriados',
  corridos: 'días corridos',
}

export function SolicitudForm({ empleado, onCerrar }: { empleado: Empleado; onCerrar: () => void }) {
  const { datos, paisDe, saldoDe, aprobadorDe, crearSolicitud } = useStore()
  const pais = paisDe(empleado)
  const aprobador = aprobadorDe(empleado)
  const hoyISO = formatearISO(new Date())

  const [tipoId, setTipoId] = useState(datos.tiposAusencia[0]?.id ?? '')
  const [fechaInicio, setFechaInicio] = useState(hoyISO)
  const [fechaReintegro, setFechaReintegro] = useState(diaSiguiente(hoyISO))
  const [fraccionInicio, setFraccionInicio] = useState<Fraccion>('completo')
  const [reintegroMediodia, setReintegroMediodia] = useState(false)
  const [comentario, setComentario] = useState('')
  const [adjunto, setAdjunto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const tipo = datos.tiposAusencia.find((t) => t.id === tipoId)

  const rango = useMemo(
    () => rangoDesdeReintegro({ fechaInicio, fraccionInicio, fechaReintegro, reintegroMediodia }),
    [fechaInicio, fraccionInicio, fechaReintegro, reintegroMediodia],
  )
  const medioDias = useMemo(
    () => (rango ? contarMedioDias(rango, pais, datos.feriados) : 0),
    [rango, pais, datos.feriados],
  )

  const saldo = tipo?.descuentaSaldo ? saldoDe(empleado, tipo.id) : undefined

  const enviar = () => {
    setError(null)
    if (!rango) return
    const resultado = crearSolicitud({
      empleadoId: empleado.id,
      tipoAusenciaId: tipoId,
      ...rango,
      comentario: comentario.trim() || undefined,
      adjuntoNombre: adjunto.trim() || undefined,
    })
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setEnviado(true)
    setTimeout(onCerrar, 1400)
  }

  if (enviado) {
    return (
      <Modal titulo="Solicitud enviada" onCerrar={onCerrar}>
        <p className="exito-inline">
          ✓ Tu solicitud fue enviada a {aprobador.nombre} y quedará registrada en tu historial.
        </p>
      </Modal>
    )
  }

  return (
    <Modal titulo="Solicitar ausencia" onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="tipo">Tipo de ausencia</label>
        <select id="tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          {datos.tiposAusencia.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icono} {t.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="inicio">Primer día de ausencia</label>
          <input
            id="inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value)
              if (e.target.value >= fechaReintegro) setFechaReintegro(diaSiguiente(e.target.value))
            }}
          />
        </div>
        <div className="campo">
          <label htmlFor="reintegro">Fecha de reintegro</label>
          <input
            id="reintegro"
            type="date"
            value={fechaReintegro}
            min={fechaInicio}
            onChange={(e) => setFechaReintegro(e.target.value)}
            aria-describedby="ayuda-reintegro"
          />
        </div>
      </div>
      <p id="ayuda-reintegro" className="meta" style={{ marginTop: -6, marginBottom: 14 }}>
        El reintegro es tu primer día de vuelta al trabajo; la ausencia cubre hasta el día anterior.
      </p>

      <div className="fila-campos">
        <div className="campo">
          <label>Primer día</label>
          <div className="segmento" role="radiogroup" aria-label="Fracción del primer día">
            {(['completo', 'tarde'] as const).map((f) => (
              <button key={f} className={fraccionInicio === f ? 'activo' : ''} onClick={() => setFraccionInicio(f)} role="radio" aria-checked={fraccionInicio === f}>
                {f === 'completo' ? 'Completo' : 'Desde la tarde'}
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <label>Reintegro</label>
          <div className="segmento" role="radiogroup" aria-label="Momento del reintegro">
            {([false, true] as const).map((mediodia) => (
              <button
                key={String(mediodia)}
                className={reintegroMediodia === mediodia ? 'activo' : ''}
                onClick={() => setReintegroMediodia(mediodia)}
                role="radio"
                aria-checked={reintegroMediodia === mediodia}
              >
                {mediodia ? 'Al mediodía' : 'Al inicio del día'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tipo?.requiereAdjunto && (
        <div className="campo">
          <label htmlFor="adjunto">Documento adjunto (requerido para {tipo.nombre})</label>
          <input
            id="adjunto"
            type="text"
            placeholder="nombre-del-archivo.pdf (simulado en el prototipo)"
            value={adjunto}
            onChange={(e) => setAdjunto(e.target.value)}
          />
        </div>
      )}

      <div className="campo">
        <label htmlFor="comentario">Comentario <span style={{ fontWeight: 400 }}>(opcional)</span></label>
        <textarea id="comentario" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Contexto para tu aprobador…" />
      </div>

      {rango ? (
        <p className="nota-info" style={{ marginBottom: 14 }}>
          Descuenta <strong style={{ color: 'var(--texto)' }}>{formatearDias(medioDias)}</strong>
          {' '}({pais.bandera} {pais.nombre}: {ETIQUETA_CONTEO[pais.metodoConteo]}).
          Te reintegras el <strong style={{ color: 'var(--texto)' }}>{formatearLargo(fechaReintegro)}</strong>
          {reintegroMediodia && ' al mediodía'}.
          {saldo && (
            <> Saldo disponible: <strong style={{ color: 'var(--texto)' }}>{formatearDias(Math.max(saldo.disponibleMedios - saldo.pendienteMedios, 0))}</strong>.</>
          )}
          {' '}Aprueba: {aprobador.nombre}.
        </p>
      ) : (
        <p className="error-inline" style={{ marginBottom: 14 }}>
          El reintegro debe ser posterior al primer día de ausencia (o el mismo día solo si vuelves al mediodía).
        </p>
      )}

      {error && <p className="error-inline" style={{ marginBottom: 14 }} role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="boton-secundario" onClick={onCerrar}>Cancelar</button>
        <button className="boton-primario" onClick={enviar} disabled={!rango || !tipo}>
          Enviar solicitud
        </button>
      </div>
    </Modal>
  )
}
