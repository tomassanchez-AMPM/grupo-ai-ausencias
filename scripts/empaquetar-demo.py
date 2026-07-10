#!/usr/bin/env python3
"""Empaqueta el build de Vite en un solo HTML autocontenido para compartir.

Uso:  npm run build && python3 scripts/empaquetar-demo.py [destino]

El <meta charset="utf-8"> es OBLIGATORIO: sin él, el archivo abierto desde
el disco (file://) se decodifica como Latin-1 y las tildes/emojis se rompen.
"""
import sys
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
dist = raiz / 'dist'

js = next(dist.glob('assets/*.js')).read_text(encoding='utf-8')
css = next(dist.glob('assets/*.css')).read_text(encoding='utf-8')

# Un "</script>" literal dentro del JS rompería el HTML inline.
js = js.replace('</script>', '<\\/script>')

salida = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ausencias · Prototipo RRHH</title>
<style>
{css}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
{js}
</script>
</body>
</html>
"""

destino = Path(sys.argv[1]) if len(sys.argv) > 1 else raiz / 'Ausencias-Demo.html'
destino.write_text(salida, encoding='utf-8')
print(f'✓ Demo empaquetada: {destino} ({destino.stat().st_size / 1024:.0f} kB)')
