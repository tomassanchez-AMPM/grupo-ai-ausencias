// Recaptura las dos pantallas públicas de ingreso (correo y código) desde el
// sitio en producción, para el manual de usuario.
//
// SIN CORREOS: la pantalla «Revisa tu correo» solo aparece después de pedir el
// acceso, y pedirlo de verdad enviaría un correo. Por eso este script NO deja
// salir ninguna petición hacia Supabase: la de pedir el código se responde
// localmente con un «ok» vacío y cualquier otra se aborta. La página que se
// fotografía es la real de producción; lo único simulado es esa respuesta.
//
// Uso:  npm run capturas        (desde docs/manual)

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const AQUI = dirname(fileURLToPath(import.meta.url))
const URL_PAUSA = process.env.PAUSA_URL ?? 'https://tomassanchez-ampm.github.io/grupo-ai-ausencias/'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Datos de ejemplo: nunca un correo ni un código reales (el repositorio es público).
const CORREO_EJEMPLO = 'ana.ejemplo@empresa.com'
const CODIGO_EJEMPLO = '48271593'

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true })
const peticionesSupabase = []
try {
  const pagina = await navegador.newPage()
  await pagina.setViewport({ width: 620, height: 600, deviceScaleFactor: 2 })

  await pagina.setRequestInterception(true)
  pagina.on('request', (peticion) => {
    const url = new URL(peticion.url())
    if (!url.hostname.endsWith('supabase.co')) return void peticion.continue()
    peticionesSupabase.push(`${peticion.method()} ${url.pathname}`)
    if (url.pathname === '/auth/v1/otp') {
      const cabeceras = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
      return void peticion.respond({ status: 200, headers: cabeceras, contentType: 'application/json', body: '{}' })
    }
    return void peticion.abort()
  })

  await pagina.goto(URL_PAUSA, { waitUntil: 'networkidle0' })
  await pagina.waitForSelector('#login-email')

  // 1) Pantalla «Inicia sesión» con el correo de ejemplo escrito.
  await pagina.type('#login-email', CORREO_EJEMPLO)
  await pagina.evaluate(() => document.activeElement?.blur())
  await pagina.screenshot({ path: join(AQUI, 'capturas', 'ingreso-correo.png') })

  // 2) Pantalla «Revisa tu correo» con un código de ejemplo escrito.
  await pagina.click('button.boton-primario')
  await pagina.waitForSelector('#login-codigo')
  await pagina.type('#login-codigo', CODIGO_EJEMPLO)
  await pagina.evaluate(() => document.activeElement?.blur())
  await pagina.screenshot({ path: join(AQUI, 'capturas', 'ingreso-codigo.png') })
} finally {
  await navegador.close()
}

console.log('Capturas guardadas en docs/manual/capturas/: ingreso-correo.png, ingreso-codigo.png')
console.log('Peticiones a Supabase interceptadas (ninguna salió a la red):', peticionesSupabase)
