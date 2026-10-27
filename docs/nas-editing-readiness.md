# Material disponible para edición

## Regla

Una producción está disponible cuando el NAS confirmó su preparación y todas sus subcarpetas tienen una confirmación manual de descarga. Cero carpetas, una solicitud pendiente o un error del NAS no equivalen a material completo.

La disponibilidad se muestra en la producción y en su pantalla de carpetas. Si falta material, muestra **Material pendiente: X de Y carpetas descargadas**.

Cuando la producción está disponible, su tarjeta también lista los trabajos vinculados y explica qué verá Edición: piezas listas, trabajo sin vincular, trabajo sin entregables, piezas ya iniciadas u otra producción del trabajo que todavía frena el material. Es solo lectura: el estado de las piezas lo siguen decidiendo los disparadores de la base.

La cola de Edición contiene entregables, vinculados a trabajos. Los trabajos se vinculan con producciones mediante `production_jobs`:

- Si todas las producciones de un trabajo tienen su material disponible, sus piezas en `DEFINED`, `PENDING_MATERIAL` o `READY_POST` quedan en `READY_POST`.
- No se asigna un editor, no se inicia la edición ni se agrega una aprobación adicional.
- Si se agrega una carpeta o se vincula otra producción pendiente, las piezas que todavía no empezaron vuelven a `PENDING_MATERIAL`.
- Las piezas que están editándose, en correcciones, revisión, aprobadas o entregadas no retroceden automáticamente.
- Los trabajos sin relación con el flujo de carpetas NAS conservan el flujo anterior.
- Si un trabajo dejó de tener producciones después de usar el flujo NAS, no se considera completo por tener cero fuentes.
- Piezas creadas después de descargar el material y producciones vinculadas después de completar la descarga también se sincronizan.
- El estado visible se actualiza al consultar/recargar la cola. No hay sincronización en tiempo real entre navegadores.

## Activación

1. Ejecutar una sola vez `supabase/migrations/20261027_nas_editing_readiness.sql`, después de las dos migraciones anteriores de carpetas y confirmaciones.
2. La migración agrega disparadores y recalcula las piezas anteriores a edición que ya están vinculadas a planes NAS. También puede pasar piezas de prueba a pendiente si falta material.
3. Publicar los cambios de la web en Netlify.
4. No requiere actualizar scripts ni tareas del Synology.

## Prueba guiada

Usar una producción de prueba vinculada a un trabajo con al menos una pieza. Confirmar todas menos una carpeta: la producción debe indicar material pendiente. Confirmar la última: la producción debe mostrar Disponible para edición y la pieza debe aparecer en Edición → Listas para edición. Su estado no debe ser En edición hasta elegir **Asignar y comenzar edición**.

Para un trabajo con dos producciones vinculadas, completar solamente una no debe habilitar la pieza. Si no hay trabajos/piezas vinculados, el material puede estar disponible pero no aparecerá una pieza nueva por sí solo.

## Implementación

Los disparadores sincronizan después de cambios en preparación, confirmaciones, vínculos producción-trabajo y creación de piezas. El registro de descarga y la actualización de disponibilidad se confirman en la misma transacción. La bandera `deliverables.nas_material_managed` mantiene la procedencia del flujo. Las funciones administrativas solo se ejecutan desde disparadores, sin permisos para clientes autenticados.

Un control de estado impide iniciar una pieza gestionada por NAS si falta material, incluso desde una pantalla vieja. La asignación existente conserva la acción explícita de empezar edición y detecta cuando ya no se actualizó ninguna pieza.

No modifica archivos ni valida integridad del backup. Los nombres y rutas preparados se conservan.
