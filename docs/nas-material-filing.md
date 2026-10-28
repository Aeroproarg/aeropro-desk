# Material acomodado en la carpeta del cliente

## Recorrido del material
1. **Preparar carpetas** en el NAS desde la producción (`Backup/AAAAMMDD-NN_NOMBRE`).
2. **Descargar**: copiar el material de cada tarjeta y confirmar cada subcarpeta.
3. **Acomodar**: una persona pasa el material a la carpeta del cliente, a mano, y lo confirma en "Carpetas NAS" anotando la ruta destino.

La plataforma no mueve ni borra archivos: solo registra quién confirmó, cuándo y dónde quedó el material.

## Reglas
- Una confirmación por producción (`nas_material_filings`, clave `plan_id`).
- Solo se puede confirmar cuando todas las subcarpetas están descargadas.
- La ruta se puede corregir: se conserva quién acomodó primero y cuándo, y se anota quién corrigió. Todo queda en Actividad.
- La ven y la confirman las mismas personas que pueden ver las carpetas NAS de la producción (`can_prepare_nas`).
- No cambia los estados de edición: las piezas se habilitan con la descarga, como antes.

## Dónde se ve
- Carpetas NAS de la producción: paso "Acomodar en la carpeta del cliente".
- Ficha de la producción: "Acomodado en …" o "Falta acomodar el material…".
- Listado de Producciones: columna Material → "Acomodado 1/1" (las producciones sin NAS muestran sus datos anteriores).
- Dashboard: "Sin acomodar" y alerta "Material sin acomodar en la carpeta del cliente".

## Pantalla anterior "Material"
Ya no se enlaza desde Carpetas NAS. Sus datos (`material_downloads`, `material_backups`, `backup_downloads`) no se borran y la pantalla sigue existiendo por su dirección para consulta.

## Activación (una sola vez)
Ejecutar `supabase/migrations/20261028_nas_material_filing.sql` en Supabase SQL Editor, después de `20261028_activity_history.sql`. No repetir.
