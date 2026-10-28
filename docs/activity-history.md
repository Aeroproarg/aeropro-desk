# Historial de actividad

## Qué registra
Cada alta, modificación o baja en las tablas de trabajo (clientes, proyectos, solicitudes, trabajos, piezas, versiones, envíos, feedback, pendientes, producciones y sus vínculos, equipo, equipamiento, checklist, carpetas y descargas NAS, sesiones de edición, usuarios y roles) queda en `activity_history` con:

- quién lo hizo (`performed_by_user_id` y su nombre en ese momento; "Sistema" si fue el NAS u otro proceso sin usuario),
- cuándo (hora del servidor),
- qué cambió (`changes`: en modificaciones solo los campos que cambiaron, con antes y después),
- si fue automático (`is_automatic`: por ejemplo, piezas que pasan a Lista para post al confirmar descargas).

Guardar sin cambios reales no genera registro. No se registran catálogos fijos ni la detección automática del NAS cada 5 minutos.

## Quién lo ve
Solo usuarios activos con rol Coordinación o Administración (`can_view_activity`). Nadie puede insertar, modificar ni borrar el historial desde la plataforma; lo escriben únicamente los disparadores de la base. Si el registro fallara, la acción de la persona no se bloquea (queda una advertencia en los logs de Postgres).

Pantalla: **Usuarios → Actividad** (`/actividad`), con filtros por persona, tipo y fechas.

## Activación (una sola vez)
1. Ejecutar `supabase/migrations/20261028_activity_history.sql` en Supabase SQL Editor. No repetir: agrega columnas y disparadores sin idempotencia.
2. Publicar la web.

Lo anterior a la activación no se reconstruye: el historial empieza vacío.

## Requisito
Para que cada acción quede a nombre de quien la hizo, cada persona debe entrar con su propio usuario. No compartir cuentas.
