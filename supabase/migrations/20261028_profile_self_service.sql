-- "Mi perfil": cada persona edita su foto, nombre de usuario, especialidad y disponibilidad, y cambia su contraseña.
-- Ejecutar UNA sola vez, después de 20261028_user_management.sql.
-- Nombre, mail, roles y baja siguen siendo solo de Coordinación/Administración.
begin;

alter table public.profiles add column avatar_url text;

-- Fotos de perfil: lectura pública por enlace (para mostrarlas sin demoras), máximo 2 MB, solo imágenes.
-- Cada persona solo puede subir, reemplazar o borrar archivos dentro de su propia carpeta: avatars/<su id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Cada persona actualiza solo su propio perfil (queda en Actividad a su nombre).
create function public.update_my_profile(
  p_display_username text, p_usual_specialty text, p_availability text, p_avatar_url text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean_username text := nullif(lower(btrim(coalesce(p_display_username, ''))), '');
  saved public.profiles%rowtype;
begin
  if me is null or not exists (select 1 from public.profiles where id = me and status = 'ACTIVE') then
    raise exception 'Iniciá sesión con un usuario activo.';
  end if;
  if coalesce(p_availability, '') not in ('AVAILABLE', 'UNAVAILABLE') then
    raise exception 'Disponibilidad inválida.';
  end if;
  if clean_username is not null then
    if clean_username !~ '^[a-z0-9._-]{2,40}$' then
      raise exception 'El nombre de usuario puede tener de 2 a 40 letras, números, punto, guion o guion bajo, sin espacios.';
    end if;
    if exists (select 1 from public.profiles where lower(display_username) = clean_username and id <> me) then
      raise exception 'Ese nombre de usuario ya lo usa otra persona.';
    end if;
  end if;
  -- La foto tiene que ser un archivo de la carpeta propia en el almacenamiento de fotos.
  if p_avatar_url is not null and position(('/storage/v1/object/public/avatars/' || me::text || '/') in p_avatar_url) = 0 then
    raise exception 'La foto no es válida.';
  end if;

  update public.profiles
     set display_username = clean_username,
         usual_specialty = nullif(btrim(coalesce(p_usual_specialty, '')), ''),
         availability = p_availability,
         avatar_url = p_avatar_url,
         updated_at = now()
   where id = me
  returning * into saved;

  return to_jsonb(saved);
end;
$$;
revoke all on function public.update_my_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;

-- Anota en Actividad que la persona cambió su propia contraseña (nunca la contraseña).
create function public.log_my_password_change()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión.';
  end if;
  insert into public.activity_history
    (entity_type, entity_id, action, description, performed_by_user_id, performed_by_name, changes, context)
  select 'profiles', p.id, 'UPDATE', p.full_name, p.id, p.full_name,
         jsonb_build_object('cuenta', jsonb_build_object('antes', null, 'despues', 'cambió su contraseña')),
         jsonb_build_object('user_id', p.id)
    from public.profiles p where p.id = auth.uid();
end;
$$;
revoke all on function public.log_my_password_change() from public, anon;
grant execute on function public.log_my_password_change() to authenticated;

commit;
