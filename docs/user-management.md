# Gestión de usuarios

## Quién puede
Solo personas activas con rol Coordinación o Administración (`can_manage_users`). Desde **Usuarios** pueden crear usuarios y, tocando el nombre de cada persona, editar nombre, mail de acceso, roles, especialidad, disponibilidad, asignar una contraseña nueva y dar de baja o reactivar.

## Baja
Nunca se borran cuentas (borrar la cuenta borraría el perfil en cascada y se perdería a quién pertenece cada registro). La baja:
- marca el perfil como `INACTIVE`,
- bloquea el ingreso en Supabase Auth,
- y si la persona tenía una sesión abierta, la plataforma le muestra "Tu acceso fue dado de baja" en lugar de cualquier pantalla.

Su nombre se conserva en trabajos, piezas, confirmaciones y en la Actividad. Se puede reactivar.

## Protecciones (en la base, no solo en la pantalla)
- Nadie puede darse de baja ni quitarse Coordinación/Administración a sí mismo.
- Siempre tiene que quedar al menos una persona activa con Coordinación o Administración.
- Solo roles válidos; al menos uno.

## Actividad
Perfil y roles se guardan con la sesión de quien gestiona (`admin_save_user_profile`), así Actividad registra quién hizo cada cambio. Los cambios de la cuenta de acceso (mail, contraseña nueva, baja/reactivación) se anotan con `log_user_account_change`. La contraseña nunca se guarda en el historial.

## Activación (una sola vez)
Ejecutar `supabase/migrations/20261028_user_management.sql` en Supabase SQL Editor, después de `20261028_nas_material_filing.sql`. No repetir. Sin esta migración, crear y editar usuarios muestran un aviso de que la gestión no está activada.
