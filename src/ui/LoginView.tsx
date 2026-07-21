// Inicio de sesión con enlace mágico + código de respaldo: algunos escáneres
// de correo corporativos (Microsoft Safe Links) consumen el enlace de un solo
// uso antes que el usuario; el código numérico escrito en la app es
// inmune a eso. (La longitud del código la define Supabase — hoy 8 dígitos.)

import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { LogoPausa } from './LogoPausa'

/** Lee errores que Supabase devuelve en el fragmento de la URL al volver de
 *  un enlace inválido/consumido (ej. #error_code=otp_expired). */
function errorDesdeUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (!hash.get('error')) return null
  const codigo = hash.get('error_code') ?? ''
  window.history.replaceState(null, '', window.location.pathname)
  if (codigo === 'otp_expired') {
    return 'Ese enlace ya fue usado o expiró (a veces el antivirus del correo lo consume). Escribe tu correo y usa el código que viene en el mensaje.'
  }
  return 'No se pudo completar el acceso con el enlace. Pide uno nuevo o usa el código del correo.'
}

export function LoginView() {
  const { entrarConCorreo, entrarConCodigo } = useStore()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado' | 'verificando'>('inicial')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const errorUrl = errorDesdeUrl()
    if (errorUrl) setAviso(errorUrl)
  }, [])

  const enviar = async () => {
    setError('')
    setAviso('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Escribe un correo válido, por ejemplo nombre@empresa.com.')
      return
    }
    setEstado('enviando')
    const resultado = await entrarConCorreo(email)
    if (!resultado.ok) {
      setEstado('inicial')
      setError(resultado.error)
      return
    }
    setEstado('enviado')
  }

  const verificarCodigo = async () => {
    setError('')
    if (!/^\d{6,10}$/.test(codigo.trim())) {
      setError('El código son los dígitos que vienen en el recuadro del correo.')
      return
    }
    setEstado('verificando')
    const resultado = await entrarConCodigo(email, codigo)
    if (!resultado.ok) {
      setEstado('enviado')
      setError('Código incorrecto o vencido. Revisa que sea el del último correo, o pide uno nuevo.')
    }
    // Si es correcto, la sesión se establece sola y esta pantalla desaparece.
  }

  return (
    <div className="login-envoltorio" style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <LogoPausa tamano={72} />
        <h1 style={{ fontSize: 30, letterSpacing: '-0.5px', marginTop: 4 }}>Pausa</h1>
        <p className="meta" style={{ marginTop: 2, fontWeight: 600 }}>Pedir. Aprobar. Desconectar.</p>
      </div>

      {estado === 'enviado' || estado === 'verificando' ? (
        <div className="tarjeta">
          <p style={{ fontSize: 34, textAlign: 'center' }} aria-hidden="true">📬</p>
          <h1 style={{ textAlign: 'center', marginTop: 6 }}>Revisa tu correo</h1>
          <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>
            Enviamos un mensaje a <strong style={{ color: 'var(--titulo)' }}>{email.trim()}</strong> con
            dos formas de entrar:
          </p>
          <p className="meta" style={{ marginTop: 12 }}>
            <strong style={{ color: 'var(--titulo)' }}>1.</strong> Pulsa el botón «Entrar a Pausa» del correo, <em>o</em>
          </p>
          <p className="meta" style={{ marginTop: 4, marginBottom: 8 }}>
            <strong style={{ color: 'var(--titulo)' }}>2.</strong> Escribe aquí el <strong style={{ color: 'var(--titulo)' }}>código de acceso</strong> que
            viene en el mismo correo (útil si el enlace te regresa a esta pantalla):
          </p>
          <div className="campo">
            <label htmlFor="login-codigo">Código de acceso</label>
            <input
              id="login-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="12345678"
              maxLength={10}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') void verificarCodigo() }}
              style={{ fontSize: 22, letterSpacing: '0.22em', textAlign: 'center', fontWeight: 700 }}
              disabled={estado === 'verificando'}
            />
          </div>
          {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
          <button
            className="boton-primario"
            style={{ width: '100%' }}
            onClick={() => void verificarCodigo()}
            disabled={estado === 'verificando' || codigo.length < 6}
          >
            {estado === 'verificando' ? 'Verificando…' : 'Entrar con el código'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 10 }}>
            <button className="boton-fantasma" onClick={() => { setEstado('inicial'); setCodigo(''); setError('') }}>
              Usar otro correo o pedir un enlace nuevo
            </button>
          </p>
        </div>
      ) : (
        <div className="tarjeta">
          <h1 style={{ textAlign: 'center' }}>Inicia sesión</h1>
          <p className="meta" style={{ textAlign: 'center', margin: '8px 0 18px' }}>
            Escribe tu correo de la empresa y te enviaremos un enlace y un código de acceso.
            Sin contraseñas.
          </p>
          {aviso && <p className="error-inline" style={{ marginBottom: 14 }} role="alert">{aviso}</p>}
          <div className="campo">
            <label htmlFor="login-email">Correo</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void enviar() }}
              disabled={estado === 'enviando'}
            />
          </div>
          {error && <p className="error-inline" style={{ marginBottom: 12 }} role="alert">{error}</p>}
          <button
            className="boton-primario"
            style={{ width: '100%' }}
            onClick={() => void enviar()}
            disabled={estado === 'enviando' || !email.trim()}
          >
            {estado === 'enviando' ? 'Enviando…' : 'Enviarme el acceso'}
          </button>
        </div>
      )}
    </div>
  )
}
