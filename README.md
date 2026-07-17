# Pausa

**Pedir. Aprobar. Desconectar.**

Plataforma de vacaciones y permisos multipaís: tracker de solicitudes
para un equipo distribuido en Nicaragua, Honduras, El Salvador y Panamá, con
reglas de acumulación y conteo de días configurables por país. Diseñada a partir del documento de diseño interno
(customizar lo que importa: políticas por país, tipos de ausencia y
compensación; fijar lo demás: roles, flujo de aprobación y privacidad).

## Stack

- **Front**: Vite + React + TypeScript estricto. Publicado en GitHub Pages.
- **Backend**: Supabase (proyecto «Pausa», ref `ozpbyncnsdxzocqczxzu`) — Postgres, Auth con
  enlace mágico por correo, y seguridad por fila (RLS): el empleado ve lo
  suyo, el jefe su equipo directo, el admin todo. La compensación es
  invisible para los jefes a nivel de base de datos.
- **Dominio puro** en `src/domain/` (acumulación, conteo por país, saldos),
  testeado con Vitest y sin dependencias de red — la fuente de verdad del
  negocio.

## Conceptos clave

- **El saldo se calcula, no se guarda**: acumulado(política, antigüedad) +
  arrastre + ajustes − aprobadas.
- **Fecha de reintegro**: el empleado declara su primer día de vuelta; la
  ausencia cubre hasta el día anterior (reintegrarse lunes incluye el fin de
  semana en países de días corridos).
- **Unidad interna**: medios días.

## Desarrollo

```bash
cp .env.example .env.local   # completar con URL y clave publishable de Supabase
npm install
npm run dev                  # http://localhost:5173
npx vitest run               # tests del dominio
npx tsc -b                   # verificación de tipos
```

## Despliegue

Cada push a `main` construye y publica a GitHub Pages
(`.github/workflows/desplegar.yml`). Definir en el repositorio las variables
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and
variables → Actions → Variables).

En Supabase (Authentication → URL Configuration) deben estar registradas la
URL de GitHub Pages como *Site URL* y `http://localhost:5173` como redirect
adicional para desarrollo.

## Estructura

```
src/domain/      lógica de negocio pura (tipos, fechas, conteo, acumulación) + tests
src/state/       store React respaldado por Supabase + mapeo de filas
src/ui/          vistas por rol (Empleado / Jefe / Admin), login, componentes
src/reportes/    exportación a Excel
supabase/        migraciones aplicadas (esquema, RLS, semilla, endurecimiento)
```
