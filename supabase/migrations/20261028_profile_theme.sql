-- Apariencia por persona: oscuro, claro o automático (según el sistema). Se elige en Mi perfil.
-- Ejecutar UNA sola vez, después de 20261028_nas_editor_access.sql. Todos arrancan en oscuro, como hasta ahora.
begin;

alter table public.profiles
  add column theme text not null default 'dark' check (theme in ('dark', 'light', 'system'));

create function public.set_my_theme(p_theme text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión.';
  end if;
  if coalesce(p_theme, '') not in ('dark', 'light', 'system') then
    raise exception 'Apariencia inválida.';
  end if;
  update public.profiles set theme = p_theme, updated_at = now() where id = auth.uid();
  return p_theme;
end;
$$;
revoke all on function public.set_my_theme(text) from public, anon;
grant execute on function public.set_my_theme(text) to authenticated;

commit;
