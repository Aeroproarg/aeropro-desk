-- Editores y carpetas NAS: una persona con rol EDITOR puede ver el estado de las carpetas NAS y confirmar
-- descargas y "material acomodado" de las producciones vinculadas a trabajos donde tiene piezas asignadas.
-- FREELANCE no recibe este acceso. Preparar carpetas sigue reservado a can_prepare_nas
-- (Coordinación, Administración, Producción, Responsable de proyecto, o responsable/participante de la producción).
-- Ejecutar UNA sola vez, después de 20261028_profile_self_service.sql. No modifica datos.
begin;

create function public.can_editor_access_nas(p_production_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE')
     and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                  where ur.user_id = auth.uid() and r.name = 'EDITOR')
     and exists (select 1 from public.production_jobs pj
                   join public.deliverables d on d.job_id = pj.job_id
                  where pj.production_id = p_production_id and d.editor_user_id = auth.uid());
$$;
revoke all on function public.can_editor_access_nas(uuid) from public, anon;
grant execute on function public.can_editor_access_nas(uuid) to authenticated;

-- Lectura: quien puede preparar, o el editor de piezas de esa producción.
drop policy nas_folder_plans_read on public.nas_folder_plans;
create policy nas_folder_plans_read on public.nas_folder_plans for select to authenticated
using (public.can_prepare_nas(production_id) or public.can_editor_access_nas(production_id));

drop policy nas_folder_downloads_read on public.nas_folder_downloads;
create policy nas_folder_downloads_read on public.nas_folder_downloads for select to authenticated
using (exists (select 1 from public.nas_folder_plans p where p.id = plan_id
  and (public.can_prepare_nas(p.production_id) or public.can_editor_access_nas(p.production_id))));

drop policy nas_material_filings_read on public.nas_material_filings;
create policy nas_material_filings_read on public.nas_material_filings for select to authenticated
using (exists (select 1 from public.nas_folder_plans p where p.id = plan_id
  and (public.can_prepare_nas(p.production_id) or public.can_editor_access_nas(p.production_id))));

-- Confirmar descarga: misma función que antes; solo cambia quién tiene permiso.
create or replace function public.confirm_nas_folder_download(p_plan_id uuid, p_equipment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  plan public.nas_folder_plans%rowtype;
  confirmation public.nas_folder_downloads%rowtype;
  person_name text;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para confirmar una descarga.';
  end if;
  -- El bloqueo evita confirmar mientras cambia la preparación del NAS.
  select * into plan from public.nas_folder_plans where id=p_plan_id for share;
  if not found or not (public.can_prepare_nas(plan.production_id) or public.can_editor_access_nas(plan.production_id)) then
    raise exception 'No tenés permiso para confirmar descargas de esta producción.';
  end if;
  if not exists (select 1 from jsonb_array_elements(plan.entries) e
    where e->>'equipmentId'=p_equipment_id::text) then
    raise exception 'La subcarpeta no pertenece a esta producción.';
  end if;
  select * into confirmation from public.nas_folder_downloads
    where plan_id=p_plan_id and equipment_id=p_equipment_id;
  if found then
    -- Reintentos y dobles clics conservan quién confirmó primero y cuándo.
    return to_jsonb(confirmation);
  end if;
  if plan.state <> 'READY' then
    raise exception 'Esperá a que el NAS confirme que las carpetas están preparadas y actualizá el estado.';
  end if;
  select full_name into person_name from public.profiles where id=auth.uid() and status='ACTIVE';
  if person_name is null then raise exception 'No se pudo identificar a la persona que confirma.'; end if;
  insert into public.nas_folder_downloads(plan_id,equipment_id,confirmed_by,confirmed_by_name)
    values(p_plan_id,p_equipment_id,auth.uid(),person_name)
    on conflict (plan_id,equipment_id) do nothing;
  select * into confirmation from public.nas_folder_downloads
    where plan_id=p_plan_id and equipment_id=p_equipment_id;
  return to_jsonb(confirmation);
end;
$$;

-- Material acomodado: misma función que antes; solo cambia quién tiene permiso.
create or replace function public.confirm_nas_material_filing(p_plan_id uuid, p_path text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  plan public.nas_folder_plans%rowtype;
  filing public.nas_material_filings%rowtype;
  person_name text;
  clean_path text := btrim(coalesce(p_path, ''));
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para confirmar.';
  end if;
  if length(clean_path) < 3 or length(clean_path) > 500 then
    raise exception 'Escribí la carpeta donde quedó el material.';
  end if;
  select * into plan from public.nas_folder_plans where id = p_plan_id for share;
  if not found or not (public.can_prepare_nas(plan.production_id) or public.can_editor_access_nas(plan.production_id)) then
    raise exception 'No tenés permiso para confirmar el material de esta producción.';
  end if;
  if not public.nas_production_material_ready(plan.production_id) then
    raise exception 'Primero confirmá la descarga de todas las carpetas.';
  end if;
  select full_name into person_name from public.profiles where id = auth.uid() and status = 'ACTIVE';
  if person_name is null then
    raise exception 'No se pudo identificar a la persona que confirma.';
  end if;

  select * into filing from public.nas_material_filings where plan_id = p_plan_id for update;
  if found then
    -- Se conserva quién acomodó primero y cuándo; solo se corrige la ruta.
    if filing.filed_path is distinct from clean_path then
      update public.nas_material_filings
         set filed_path = clean_path, path_updated_at = now(), path_updated_by_name = person_name
       where plan_id = p_plan_id
       returning * into filing;
    end if;
    return to_jsonb(filing);
  end if;

  insert into public.nas_material_filings (plan_id, filed_path, filed_by, filed_by_name)
  values (p_plan_id, clean_path, auth.uid(), person_name)
  on conflict (plan_id) do nothing;
  select * into filing from public.nas_material_filings where plan_id = p_plan_id;
  return to_jsonb(filing);
end;
$$;

commit;
