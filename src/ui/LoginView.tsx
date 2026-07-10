// Inicio de sesión con enlace mágico: el usuario escribe su correo y recibe
// un enlace de un solo uso. Sin contraseñas que olvidar ni resetear.

import { useState } from 'react'
import { useStore } from '../state/store'

export function LoginView() {
  const { entrarConCorreo } = useStore()
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado'>('inicial')
  const [error, setError] = useState('')

  const enviar = async () => {
    setError('')
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

  return (
    <div className="login-envoltorio" style={{ maxWidth: 460 }}>
      <div className="marca" style={{ justifyContent: 'center', marginBottom: 6 }}>
        <span className="marca-logo" aria-hidden="true">🌴</span>
        <span>Ausencias</span>
      </div>

      {estado === 'enviado' ? (
        <div className="tarjeta" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 34 }} aria-hidden="true">📬</p>
          <h1 style={{ marginTop: 6 }}>Revisa tu correo</h1>
          <p className="meta" style={{ marginTop: 8 }}>
            Enviamos un enlace de acceso a <strong style={{ color: 'var(--titulo)' }}>{email.trim()}</strong>.
            Ábrelo desde este dispositivo para entrar. Puede tardar un par de minutos;
            revisa también la carpeta de spam.
          </p>
          <button className="boton-fantasma" style={{ marginTop: 14 }} onClick={() => setEstado('inicial')}>
            Usar otro correo
          </button>
        </div>
      ) : (
        <div className="tarjeta">
          <h1 style={{ textAlign: 'center' }}>Inicia sesión</h1>
          <p className="meta" style={{ textAlign: 'center', margin: '8px 0 18px' }}>
            Escribe tu correo de la empresa y te enviaremos un enlace de acceso.
            Sin contraseñas.
          </p>
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
            {estado === 'enviando' ? 'Enviando enlace…' : 'Enviarme el enlace de acceso'}
          </button>
        </div>
      )}
    </div>
  )
}
