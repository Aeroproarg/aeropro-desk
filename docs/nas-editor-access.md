# Editores y carpetas NAS

- **Edición (rol EDITOR):** en las producciones vinculadas a trabajos donde tiene piezas asignadas (como editor de la pieza), ve las carpetas NAS, confirma descargas y confirma el material acomodado. No prepara carpetas nuevas.
- **Freelance:** no tiene este acceso (salvo que además sea responsable o participante de la producción).
- **Preparar carpetas:** Coordinación, Administración, Producción, Responsable de proyecto, o responsable/participante de la producción (`can_prepare_nas`). En "Carpetas NAS", quien no puede preparar no ve la sección de equipos ni la vista previa.

Implementación: `can_editor_access_nas(production_id)` se suma a las reglas de lectura de `nas_folder_plans`, `nas_folder_downloads` y `nas_material_filings`, y a los permisos de `confirm_nas_folder_download` y `confirm_nas_material_filing`.

Activación (una sola vez): `supabase/migrations/20261028_nas_editor_access.sql`, después de `20261028_profile_self_service.sql`. No repetir.
