# Calendario y Google Calendar

## Qué hace
- `/calendario`: grilla mensual con producciones (azul) y reuniones/eventos (amarillo). En el celular, lista del mes.
- Reuniones: crear, editar y borrar desde `/calendario/eventos/...` (Coordinación, Administración, Producción, Responsable de proyecto y Edición; Freelance solo ve).
- Cada cambio en producciones, reuniones o participantes deja un pedido en `calendar_sync_queue` (migración `20261028_calendar.sql`).
- `POST /api/calendar/sync` copia esos cambios al Google Calendar compartido "AeroPro Desk" (cuenta aeroproargentina@gmail.com) con una cuenta de servicio.
  - Lo llama un Database Webhook de Supabase en cada pedido nuevo (header `x-calendar-sync-secret`) y también el botón "Sincronizar ahora".
  - Código de evento fijo (`aprod…` / `aevt…`): nunca duplica. Si alguien lo borra en Google, la próxima sincronización lo vuelve a crear.
  - Producción cancelada / no realizada / sin fecha y reunión cancelada o borrada: se quita de Google.

## Variables en Netlify (nunca en el código)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY` (la `private_key` del JSON), `GOOGLE_CALENDAR_ID`, `CALENDAR_SYNC_SECRET`.

## Pendiente (fase 2)
- Que los cambios hechos en Google vuelvan a la plataforma (doble vía).
