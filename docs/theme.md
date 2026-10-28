# Apariencia (modo oscuro / claro)

Cada persona elige en **Mi perfil → Apariencia**: Oscuro (por defecto), Claro o Automático (según el sistema de la compu o el celular). Se guarda en `profiles.theme` y vale en cualquier dispositivo. La pantalla de login queda en oscuro.

## Cómo funciona
- `app/layout.tsx` pone `data-theme` en `<html>` desde el servidor (sin parpadeo).
- `app/globals.css` define el modo claro reemplazando la paleta de Tailwind (grises, blanco/negro y colores de estado) y los fondos fijos de la plataforma (`#050607`, `#0B0F12`, `#080A0C`, `#07090B`) y el celeste de textos. Las pantallas no se tocan.
- Si en una pantalla nueva se usa otro color fijo (`bg-[#......]`), agregarlo a las reglas de modo claro de `globals.css`.

## Activación (una sola vez)
`supabase/migrations/20261028_profile_theme.sql`, después de `20261028_nas_editor_access.sql`, y antes de publicar. No repetir.
