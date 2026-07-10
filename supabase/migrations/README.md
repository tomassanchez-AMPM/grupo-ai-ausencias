# Migraciones

Estas migraciones ya están aplicadas en el proyecto Supabase `ampm-ausencias`
(`ozpbyncnsdxzocqczxzu`). Se guardan aquí como registro versionado; para un
proyecto nuevo, aplicarlas en orden con el SQL Editor o `supabase db push`.

1. `0001_esquema_inicial` — tablas, índices y restricciones
2. `0002_funciones_y_rls` — funciones auxiliares, vínculo Auth↔empleados y políticas RLS
3. `0003_datos_semilla` — países, tipos, políticas, feriados 2026 y equipo inicial
4. `0004_endurecimiento_seguridad` — revocaciones a anon y política estricta de notificaciones
