# Mi perfil

Cada persona entra a **Mi perfil** tocando su foto o su nombre en la barra de arriba (en el celular, desde el menú ☰).

## Qué puede cambiar cada uno
- Foto de perfil: se recorta cuadrada y se achica a 320×320 en el navegador antes de subirla (JPG). La anterior se borra.
- Nombre de usuario (opcional, sin espacios, único), especialidad y disponibilidad.
- Su contraseña (mínimo 8 caracteres). Si Supabase pide reautenticación, hay que cerrar sesión y volver a entrar.

Nombre, mail de acceso, roles y baja los gestiona Coordinación o Administración desde Usuarios.

## Seguridad
- Las fotos están en el almacenamiento `avatars` de Supabase (máx. 2 MB, solo imágenes), dentro de una carpeta por persona (`avatars/<id>/`). Cada uno solo puede subir o borrar en su carpeta.
- Las fotos se leen por enlace público (para mostrarlas rápido). No subir información sensible como foto.
- `update_my_profile` solo modifica el perfil propio y valida que la foto sea de la carpeta propia. Usuarios dados de baja no pueden editar.
- Cambios de perfil y de contraseña quedan en Actividad a nombre de la persona; la contraseña nunca se guarda.

## Activación (una sola vez)
Ejecutar `supabase/migrations/20261028_profile_self_service.sql` en Supabase SQL Editor, después de `20261028_user_management.sql`, y **antes** de publicar la web. No repetir.
