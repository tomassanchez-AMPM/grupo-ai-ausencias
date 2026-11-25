// Convierte manual.html en public/Manual-Pausa.pdf con el Chrome del sistema
// (puppeteer-core no descarga navegador). Antes de escribir el PDF comprueba
// que ninguna página se desborde: cada <section class="pagina"> es una hoja
// carta de alto fijo y el texto que no quepa quedaría cortado.
//
// Uso:  npm run pdf        (desde docs/manual)

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ORIGEN = join(AQUI, 'manual.html')
const DESTINO = resolve(process.argv[2] ?? join(AQUI, '..', '..', 'public', 'Manual-Pausa.pdf'))
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  const pagina = await navegador.newPage()
  await pagina.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 })
  await pagina.goto(pathToFileURL(ORIGEN).href, { waitUntil: 'networkidle0' })

  const revision = await pagina.evaluate(() => {
    const rotas = [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute('src'))
    const paginas = [...document.querySelectorAll('.pagina')].map((seccion, i) => {
      const pie = seccion.querySelector('.pie')
      const topePie = pie.getBoundingClientRect().top
      // El contenido debe terminar antes de la raya del pie de página.
      const fondo = Math.max(...[...seccion.children].filter((el) => el !== pie).map((el) => el.getBoundingClientRect().bottom))
      return { pagina: i + 1, sobraPx: Math.round(topePie - fondo) }
    })
    return { rotas, paginas }
  })

  if (revision.rotas.length > 0) throw new Error(`Capturas que no cargaron: ${revision.rotas.join(', ')}`)
  for (const p of revision.paginas) console.log(`pág. ${p.pagina}: ${p.sobraPx} px libres antes del pie`)
  const desbordadas = revision.paginas.filter((p) => p.sobraPx < 8)
  if (desbordadas.length > 0) {
    throw new Error(`El contenido no cabe en la(s) página(s) ${desbordadas.map((p) => p.pagina).join(', ')}: recorta texto o achica una captura.`)
  }

  await pagina.pdf({ path: DESTINO, format: 'Letter', printBackground: true, preferCSSPageSize: true })
  console.log(`PDF generado: ${DESTINO}`)
} finally {
  await navegador.close()
}
