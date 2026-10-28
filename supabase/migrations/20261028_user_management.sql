-- Gestión de usuarios desde la plataforma, registrando en Actividad QUIÉN hizo cada cambio.
-- Ejecutar UNA sola vez, después de 20261028_nas_material_filing.sql.
-- No modifica usuarios existentes. Las cuentas nunca se borran: la baja bloquea el acceso y conserva el historial.
begin;

-- Coordinación o Administración, con perfil activo.
create function public.can_manage_users()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE')
     and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                  where ur.user_id = auth.uid() and r.name in ('COORDINACION', 'ADMINISTRACION'));
$$;
revoke all on function public.can_manage_users() from public, anon;
grant execute on function public.can_manage_users() to authenticated;

-- Crea o actualiza perfil y roles. Se llama con la sesión de quien gestiona, así Actividad lo registra a su nombre.
create function public.admin_save_user_profile(
  p_user_id uuid, p_full_name text, p_usual_specialty text, p_availability text, p_roles text[], p_status text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  allowed text[] := array['RESPONSABLE_PROYECTO', 'COORDINACION', 'PRODUCCION', 'ADMINISTRACION', 'EDITOR', 'FREELANCE'];
  clean_roles text[];
  saved public.profiles%rowtype;
begin
  if not public.can_manage_users() then
    raise exception 'No tenés permiso para gestionar usuarios.';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'La cuenta no existe.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if coalesce(p_status, '') not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Estado inválido.';
  end if;
  if coalesce(p_availability, '') not in ('AVAILABLE', 'UNAVAILABLE') then
    raise exception 'Disponibilidad inválida.';
  end if;
  select array_agg(distinct role_name order by role_name) into clean_roles from unnest(coalesce(p_roles, '{}')) role_name;
  if clean_roles is null then
    raise exception 'Seleccioná al menos un rol.';
  end if;
  if not clean_roles <@ allowed
     or (select count(*) from public.roles where name = any (clean_roles)) <> cardinality(clean_roles) then
    raise exception 'Se recibió un rol inválido.';
  end if;

  -- Nadie puede darse de baja ni quitarse la gestión de usuarios a sí mismo.
  if p_user_id = auth.uid() then
    if p_status <> 'ACTIVE' then
      raise exception 'No podés darte de baja a vos mismo.';
    end if;
    if not (clean_roles && array['COORDINACION', 'ADMINISTRACION']) then
      raise exception 'No podés quitarte Coordinación o Administración a vos mismo.';
    end if;
  end if;

  insert into public.profiles (id, full_name, status, usual_specialty, availability)
  values (p_user_id, btrim(p_full_name), p_status, nullif(btrim(coalesce(p_usual_specialty, '')), ''), p_availability)
  on conflict (id) do update
    set full_name = excluded.full_name, status = excluded.status,
        usual_specialty = excluded.usual_specialty, availability = excluded.availability, updated_at = now()
  returning * into saved;

  delete from public.user_roles ur using public.roles r
   where ur.role_id = r.id and ur.user_id = p_user_id and not (r.name = any (clean_roles));
  insert into public.user_roles (user_id, role_id)
  select p_user_id, r.id from public.roles r where r.name = any (clean_roles)
  on conflict do nothing;

  -- Siempre tiene que quedar alguien activo que pueda gestionar usuarios.
  if not exists (
    select 1 from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id
     where p.status = 'ACTIVE' and r.name in ('COORDINACION', 'ADMINISTRACION')
  ) then
    raise exception 'Tiene que quedar al menos una persona activa con Coordinación o Administración.';
  end if;

  return to_jsonb(saved) || jsonb_build_object('roles', to_jsonb(clean_roles));
end;
$$;
revoke all on function public.admin_save_user_profile(uuid, text, text, text, text[], text) from public, anon;
grant execute on function public.admin_save_user_profile(uuid, text, text, text, text[], text) to authenticated;

-- Cambios de la cuenta de acceso (mail, contraseña, bloqueo) que se hacen fuera de estas tablas:
-- se anotan en Actividad a nombre de quien los hizo. Nunca se guarda la contraseña.
create function public.log_user_account_change(p_user_id uuid, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_users() then
    raise exception 'No tenés permiso para gestionar usuarios.';
  end if;
  insert into public.activity_history
    (entity_type, entity_id, action, description, performed_by_user_id, performed_by_name, changes, context)
  values
    ('profiles', p_user_id, 'UPDATE',
     (select full_name from public.profiles where id = p_user_id),
     auth.uid(),
     (select full_name from public.profiles where id = auth.uid()),
     jsonb_build_object('cuenta', jsonb_build_object('antes', null, 'despues', left(coalesce(p_description, ''), 200))),
     jsonb_build_object('user_id', p_user_id));
end;
$$;
revoke all on function public.log_user_account_change(uuid, text) from public, anon;
grant execute on function public.log_user_account_change(uuid, text) to authenticated;

commit;
