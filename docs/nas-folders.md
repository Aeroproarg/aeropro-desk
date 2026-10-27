# Preparación de carpetas de AeroPro Desk

Implementación para el proyecto local `C:\Users\aerop\aeropro-desk`.
No está publicada ni instalada en el NAS por generar estos archivos.

## Comportamiento

- En una producción: **Preparar carpeta en NAS → elegir equipos → vista previa → confirmar**.
- Usa `production_equipment.used_by_user_id`, no la persona que prepara ni descarga.
- Solo se seleccionan equipos que generan material; no se crean carpetas para todos los accesorios automáticamente.
- Asigna `AAAAMMDD-01_NOMBRE` a la producción; fecha del rodaje en Buenos Aires.
- Una producción equivale a una visita/jornada en este flujo. Si abarca varias jornadas, registrarlas como producciones distintas para obtener carpetas distintas.
- Reserva correlativo en una transacción, con bloqueo compartido por las confirmaciones. La vista previa no reserva ni crea nada.
- La ruta se conserva aunque cambien fecha o nombre de la producción posteriormente.
- Cada asignación tiene carpeta persistente, por ejemplo `001_SONY_FX3_CRIS`. La numeración distingue dos equipos con el mismo modelo y operador.
- Un cambio de operador de una asignación ya preparada requiere agregar otra asignación; no se renombra ni se reasigna el material anterior.
- Si la solicitud se repite, se reutiliza. Si se agregan equipos, se agregan subcarpetas.
- La tarea del NAS consulta cada cinco minutos por HTTPS. Usa el token privado ya instalado. No requiere conexiones entrantes al NAS.
- Estado `READY` significa carpetas preparadas, NO descarga ni backup completo.
- El detector conserva su comportamiento para carpetas antiguas y excluye el formato reservado `AAAAMMDD-NN_NOMBRE` completo. El material de esas producciones se registra y verifica desde la pantalla Material de cada producción. Esta versión no verifica la finalización de copias ni calcula checksums.
- No se reorganizan detecciones ni archivos existentes.

## Archivos y activación (guiar de a un paso)

1. Ejecutar `supabase/migrations/20261026_nas_folder_plans.sql` **una sola vez** en Supabase SQL Editor. Crea una tabla nueva con políticas y funciones. No ejecutarla nuevamente si ya existe; se incluye una transacción para que un fallo no deje una instalación parcial.
2. Publicar los cambios de la web en Netlify después de compilar. Las variables existentes alcanzan. No se incluyen claves en estos archivos.
3. Deshabilitar la tarea del NAS y esperar que termine cualquier ejecución. Copiar `nas/aeropro_nas.py` y `nas/aeropro_prepare_folders.py` al directorio privado `/volume1/@aeropro-desk`, conservando propietario `aeropro` y permisos 600. Conservar token, base SQLite e historiales. Guardar una copia del script anterior para volver atrás.
4. Reemplazar el contenido de la tarea de detección por `nas/run_nas.sh`; usuario `aeropro`, todavía deshabilitada.
5. Confirmar una producción de prueba con dos equipos. Ejecutar la tarea manualmente. Revisar `_aeropro_desk_preparacion.txt`, actualizar estado en la web y verificar ambas carpetas desde Finder/Explorador usando las cuentas habituales del equipo. Los permisos finales dependen de las ACL heredadas de Backup; no se modifican permisos de material existente.
6. Repetir la solicitud: verificar que no cambia la ruta ni se duplica. Agregar un tercer equipo y comprobar que se crea solo su subcarpeta. Una carpeta preparada vacía no debe aparecer como backup detectado.
7. Habilitar la tarea cada cinco minutos. La tarea de instalación anterior permanece deshabilitada.

## Seguridad y errores

- Las solicitudes web requieren usuario activo y ser responsable/participante de la producción o tener un rol de gestión de producciones.
- No se conceden escrituras directas a usuarios sobre los planes. La función de confirmación vuelve a leer las asignaciones y valida la vista previa.
- El endpoint del NAS solo permite consultar pendientes y confirmar una revisión concreta; no recibe rutas arbitrarias para crear.
- El worker rechaza rutas con separadores, caracteres no permitidos, enlaces simbólicos y carpetas existentes sin marcador propio. Nunca sobrescribe archivos de material.
- Una interrupción justo después de crear la carpeta principal y antes de guardar el marcador puede requerir revisión manual. Es preferible detenerse a adoptar una carpeta ajena.
- Una confirmación perdida se reintenta. Una revisión vieja no puede confirmar una revisión nueva.
- Los errores de creación se muestran en la web; corregir permisos/conflicto y volver a confirmar desde la vista previa. No se borran carpetas al reintentar.

## Verificación

`tests/test_worker.py`: validación de rutas, reintentos y exclusión de carpetas preparadas. La prueba real de creación con `dir_fd`/`O_NOFOLLOW` requiere Linux, como el Synology.

`tests/folder-plans.mjs`: pruebas SQL aisladas con PGlite y esquema de ejemplo. No conecta a Supabase. Cubre numeración, colisiones, confirmaciones obsoletas, autorizaciones, operador faltante y persistencia de rutas. Ejecutar con `@electric-sql/pglite` instalado en `outputs/nas-folder-test-runtime` del workspace de esta tarea.

Antes de activar en producción, hacer la prueba de NAS del punto 5. Las pruebas locales no confirman los permisos SMB ni el esquema real de Supabase.
