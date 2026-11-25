# Manual de usuario de Pausa

Fuente del PDF que se publica en `public/Manual-Pausa.pdf` y que la función
`enviar-invitacion` adjunta a cada correo de bienvenida.

| Archivo | Qué es |
| --- | --- |
| `manual.html` | El manual: cuatro páginas tamaño carta, una por `<section class="pagina">`. |
| `capturas/` | Las pantallas que usa el manual, todas con datos ficticios. |
| `generar-pdf.mjs` | Convierte `manual.html` en `public/Manual-Pausa.pdf`. |
| `capturar-ingreso.mjs` | Vuelve a fotografiar las dos pantallas públicas de ingreso. |

## Actualizar el manual

```bash
cd docs/manual
npm install        # solo la primera vez (puppeteer-core; usa el Chrome instalado)
npm run pdf        # escribe ../../public/Manual-Pausa.pdf
```

El script se detiene si una captura no carga o si el contenido de alguna
página no cabe en la hoja. Después de generarlo, abre el PDF y revisa las
cuatro páginas antes de hacer commit: cada push a `main` lo publica.

Si Chrome no está en la ruta habitual de macOS, indícala con `CHROME_PATH`.

## Reglas de contenido

- Cada afirmación debe poder señalarse en el código (`src/ui`, `src/state`,
  `src/domain`, `supabase/`). Si el producto cambia, el manual cambia con él.
- Los textos entre comillas son los rótulos exactos de la interfaz.
- El módulo de Planilla es de acceso restringido y no va en este manual.
- El repositorio es público: en las capturas solo datos de ejemplo.

## Capturas

| Captura | Pantalla | Origen |
| --- | --- | --- |
| `ingreso-correo.png`, `ingreso-codigo.png` | Ingreso con correo y código | Producción, con `npm run capturas` (nov-2026) |
| `mi-espacio-saldo.png`, `mi-espacio-pendiente.png` | Mi espacio | Manual de jul-2026 — **desactualizadas**: el encabezado hoy también muestra la empresa |
| `solicitar-ausencia.png` | Formulario de solicitud | Manual de jul-2026; sigue igual a la pantalla actual |
| `mi-equipo-bandeja.png`, `mi-equipo-calendario-saldos.png` | Mi equipo | Manual de jul-2026; siguen iguales a la pantalla actual |

`npm run capturas` abre el sitio en producción y fotografía las dos pantallas
de ingreso. No envía ningún correo: intercepta la petición que pide el código
y la responde localmente, y aborta cualquier otra llamada a Supabase.

Las demás pantallas exigen sesión, así que hay que capturarlas a mano con una
cuenta de ejemplo (1280 px de ancho, escala 2×). Pendientes de renovar o de
agregar:

- **Mi espacio** con la empresa en el encabezado (las dos capturas actuales).
- **Aviso de sobregiro** en el formulario de solicitud («Esta solicitud supera tu saldo»).
- **Tarjeta de aprobación con sobregiro** en la bandeja («No cuenta con el saldo requerido»).
- **Sección «Aprobadas en curso o próximas»** con la cancelación y su motivo.
- **Saldo sobregirado** en la tarjeta de Mi espacio y en «Saldos del equipo».
