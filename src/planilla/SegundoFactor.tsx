// Puerta de segundo factor (TOTP) para Planilla. La primera vez la persona
// vincula una aplicación autenticadora con un código QR; después solo escribe
// el código de 6 dígitos. La base rechaza cualquier llamada de Planilla sin
// este paso, así que esta pantalla es comodidad, no la barrera real.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Fase = 'cargando' | 'inscribir' | 'verificar' | 'error'

export function SegundoFactor({ onListo }: { onListo: () => void }) {
  const [fase, setFase] = useState<Fase>('cargando')
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secreto, setSecreto] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    let vigente = true
    const preparar = async () => {
      try {
        const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!vigente) return
        if (nivel?.currentLevel === 'aal2') {
          onListo()
          return
        }
        const { data: factores, error: errorLista } = await supabase.auth.mfa.listFactors()
        if (errorLista) throw errorLista
        if (!vigente) return
        const verificado = factores.totp.find((f) => f.status === 'verified')
        if (verificado) {
          setFactorId(verificado.id)
          setFase('verificar')
          return
        }
        // Limpia inscripciones a medias antes de empezar una nueva.
        for (const f of factores.all) {
          if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        const { data: nuevo, error: errorAlta } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `Pausa Planilla ${new Date().toISOString().slice(0, 16)}`,
        })
        if (errorAlta) throw errorAlta
        if (!vigente) return
        setFactorId(nuevo.id)
        setQr(nuevo.totp.qr_code)
        setSecreto(nuevo.totp.secret)
        setFase('inscribir')
      } catch (e) {
        if (!vigente) return
        setError(e instanceof Error ? e.message : 'No se pudo preparar la verificación en dos pasos.')
        setFase('error')
      }
    }
    void preparar()
    return () => { vigente = false }
  }, [onListo])

  const verificar = async () => {
    if (!/^\d{6}$/.test(codigo) || verificando) return
    setVerificando(true)
    setError('')
    const { error: errorVerificacion } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo })
    setVerificando(false)
    if (errorVerificacion) {
      setCodigo('')
      setError('Código incorrecto o vencido. Escribe el que muestra tu aplicación en este momento.')
      return
    }
    onListo()
  }

  if (fase === 'cargando') return <p className="meta">Preparando la verificación en dos pasos…</p>

  if (fase === 'error') {
    return (
      <div className="tarjeta" style={{ maxWidth: 520 }}>
        <h2>No se pudo iniciar la verificación en dos pasos</h2>
        <p className="error-inline" style={{ marginTop: 10 }} role="alert">{error}</p>
        <p className="meta" style={{ marginTop: 8 }}>Recarga la página e inténtalo de nuevo.</p>
      </div>
    )
  }

  return (
    <div className="tarjeta" style={{ maxWidth: 520 }}>
      <h2>🔐 Verificación en dos pasos</h2>
      {fase === 'inscribir' ? (
        <>
          <p className="meta" style={{ margin: '8px 0 14px' }}>
            Planilla contiene salarios y cuentas bancarias, así que pide un segundo paso además del
            código por correo. Solo se configura una vez:
          </p>
          <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
            <li>Abre una aplicación autenticadora en tu teléfono (Microsoft Authenticator, Google Authenticator o similar).</li>
            <li>Agrega una cuenta escaneando este código:</li>
          </ol>
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <img src={qr} alt="Código QR para la aplicación autenticadora" width={190} height={190} style={{ background: '#fff', padding: 8, borderRadius: 10 }} />
            <p className="meta" style={{ marginTop: 6, wordBreak: 'break-all' }}>
              ¿No puedes escanear? Escribe esta clave en la aplicación: <strong style={{ color: 'var(--titulo)' }}>{secreto}</strong>
            </p>
          </div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>3. Escribe el código de 6 dígitos que muestra la aplicación:</p>
        </>
      ) : (
        <p className="meta" style={{ margin: '8px 0 14px' }}>
          Escribe el código de 6 dígitos de tu aplicación autenticadora para entrar a Planilla.
        </p>
      )}
      <div className="campo">
        <label htmlFor="codigo-2fa">Código de la aplicación</label>
        <input
          id="codigo-2fa"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') void verificar() }}
          style={{ fontSize: 22, letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700 }}
          disabled={verificando}
        />
      </div>
      {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
      <button className="boton-primario" style={{ width: '100%' }} onClick={() => void verificar()} disabled={verificando || codigo.length !== 6}>
        {verificando ? 'Verificando…' : 'Entrar a Planilla'}
      </button>
    </div>
  )
}
