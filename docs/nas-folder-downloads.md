# Confirmaciones de descarga por subcarpeta

## Uso

En **Producción → Preparar carpeta en NAS → Descargas por carpeta**, marcar cada subcarpeta cuando haya terminado de copiarse todo su material.

- Cada combinación de equipo y operador mantiene su estado de forma independiente.
- Se registra el usuario que confirma y la hora del servidor. No se toma el operador como responsable de la descarga.
- La fecha se muestra en hora de Argentina.
- Repetir la confirmación no modifica quién confirmó primero ni cuándo.
- Una carpeta nueva aumenta el total y comienza pendiente. Las confirmaciones previas se conservan.
- La pantalla de la producción y la de carpetas muestran **X de Y carpetas descargadas**.
- **Actualizar estado** vuelve a consultar la preparación y las confirmaciones de otras personas.
- No se permite completar una carpeta nueva hasta que el NAS confirme la preparación de la solicitud.
- La confirmación es manual. No inspecciona archivos, comprueba integridad, modifica el estado de backup ni alimenta automáticamente los registros anteriores de Material. El registro de backup sigue siendo separado.

## Activación

1. Ejecutar una sola vez `supabase/migrations/20261027_nas_folder_downloads.sql` en SQL Editor. Requiere la migración anterior de preparación de carpetas. Agrega tabla, política y función; no altera archivos ni confirmaciones existentes.
2. Publicar los cambios de la web por el flujo GitHub → Netlify.
3. No hay que actualizar scripts, token ni tareas del Synology.
4. En una producción de prueba con dos subcarpetas preparadas, marcar una: debe mostrar **1 de 2**, el nombre de la persona conectada y la hora. Recargar y volver a la producción: deben conservarse.
5. Agregar un tercer equipo a la preparación no debe borrar las confirmaciones anteriores. Cuando el NAS confirme, el nuevo equipo debe seguir pendiente.

## Permisos y almacenamiento

La tabla `nas_folder_downloads` tiene una clave por plan y asignación de equipo, independiente del nombre visible. Solo permite lecturas autorizadas mediante RLS; las escrituras se hacen mediante `confirm_nas_folder_download`, que obtiene usuario y hora en el servidor, valida acceso a la producción y pertenencia de la subcarpeta, y conserva la primera confirmación.

No se ofrece un botón para deshacer confirmaciones en esta versión. La tabla no registra verificaciones físicas ni representa un historial de cambios de archivos posteriores.
