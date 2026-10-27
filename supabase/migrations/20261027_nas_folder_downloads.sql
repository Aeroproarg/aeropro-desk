-- Ejecutar una vez, después de 20261026_nas_folder_plans.sql.
-- Registra confirmaciones manuales. No modifica archivos ni estados de backup.
begin;

create table public.nas_folder_downloads (
  plan_id uuid not null references public.nas_folder_plans(id),
  equipment_id uuid not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references public.profiles(id),
  confirmed_by_name text not null,
  primary key (plan_id, equipment_id)
);
alter table public.nas_folder_downloads enable row level security;
revoke all on public.nas_folder_downloads from anon, authenticated;
grant select on public.nas_folder_downloads to authenticated;
grant all on public.nas_folder_downloads to service_role;

create policy nas_folder_downloads_read on public.nas_folder_downloads
for select to authenticated using (
  exists (select 1 from public.nas_folder_plans p
    where p.id=plan_id and public.can_prepare_nas(p.production_id))
);

create function public.confirm_nas_folder_download(p_plan_id uuid, p_equipment_id uuid)
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
  if not found or not public.can_prepare_nas(plan.production_id) then
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
revoke all on function public.confirm_nas_folder_download(uuid,uuid) from public, anon;
grant execute on function public.confirm_nas_folder_download(uuid,uuid) to authenticated;
commit;
