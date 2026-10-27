-- Ejecutar una vez en Supabase SQL Editor. No modifica material ni detecciones.
begin;

create table public.nas_folder_plans (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null unique references public.productions(id),
  capture_date date not null,
  daily_number integer not null check (daily_number > 0),
  root_name text not null unique,
  entries jsonb not null check (jsonb_typeof(entries) = 'array'),
  revision integer not null default 1,
  state text not null default 'PENDING' check (state in ('PENDING','READY','ERROR')),
  last_error text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  prepared_at timestamptz,
  unique (capture_date, daily_number)
);
alter table public.nas_folder_plans enable row level security;
revoke all on public.nas_folder_plans from anon, authenticated;
grant select on public.nas_folder_plans to authenticated;
grant all on public.nas_folder_plans to service_role;

create function public.can_prepare_nas(p_production_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id=auth.uid() and status='ACTIVE')
  and (
    exists (select 1 from public.productions where id=p_production_id and responsible_user_id=auth.uid())
    or exists (select 1 from public.production_participants where production_id=p_production_id and user_id=auth.uid())
    or exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
      where ur.user_id=auth.uid() and r.name in ('COORDINACION','ADMINISTRACION','PRODUCCION','RESPONSABLE_PROYECTO'))
  );
$$;
revoke all on function public.can_prepare_nas(uuid) from public, anon;
grant execute on function public.can_prepare_nas(uuid) to authenticated;
create policy nas_folder_plans_read on public.nas_folder_plans for select to authenticated
using (public.can_prepare_nas(production_id));

create function public.nas_folder_slug(p_text text)
returns text language sql immutable set search_path = '' as $$
  select left(trim(both '_' from regexp_replace(
    translate(upper(coalesce(p_text,'')), 'ÁÉÍÓÚÜÑÀÈÌÒÙ', 'AEIOUUNAEIOU'),
    '[^A-Z0-9]+','_','g')), 55);
$$;
revoke all on function public.nas_folder_slug(text) from public, anon, authenticated;

create function public.prepare_nas_folders(
  p_production_id uuid, p_equipment_ids uuid[],
  p_confirm boolean default false, p_snapshot text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prod record;
  plan public.nas_folder_plans%rowtype;
  eq record;
  old_entry jsonb;
  all_entries jsonb := '[]';
  selected_entries jsonb := '[]';
  entry jsonb;
  day date;
  number integer;
  root text;
  snapshot text;
  changed boolean := false;
  has_plan boolean;
begin
  if auth.uid() is null or not public.can_prepare_nas(p_production_id) then
    raise exception 'No tenés permiso para preparar carpetas de esta producción.';
  end if;
  if coalesce(cardinality(p_equipment_ids),0) not between 1 and 100
    or cardinality(p_equipment_ids) <> (select count(distinct x) from unnest(p_equipment_ids) x) then
    raise exception 'Seleccioná entre 1 y 100 equipos sin repetir.';
  end if;
  -- Serializa la asignación del correlativo y las confirmaciones concurrentes.
  perform pg_advisory_xact_lock(20261026, 1);
  select id,name,start_at into prod from public.productions where id=p_production_id for share;
  if not found or prod.start_at is null then
    raise exception 'La producción debe tener una fecha de rodaje.';
  end if;
  select * into plan from public.nas_folder_plans where production_id=p_production_id for update;
  has_plan := found;
  if has_plan then
    day := plan.capture_date; number := plan.daily_number; root := plan.root_name;
    all_entries := plan.entries;
  else
    day := (prod.start_at at time zone 'America/Argentina/Buenos_Aires')::date;
    select coalesce(max(daily_number),0)+1 into number from public.nas_folder_plans where capture_date=day;
    root := to_char(day,'YYYYMMDD') || '-' || lpad(number::text,greatest(2,length(number::text)),'0')
      || '_' || coalesce(nullif(public.nas_folder_slug(prod.name),''),'PRODUCCION');
  end if;
  if (select count(*) from public.production_equipment where production_id=p_production_id and id=any(p_equipment_ids)) <> cardinality(p_equipment_ids) then
    raise exception 'Algún equipo ya no pertenece a esta producción. Actualizá la página.';
  end if;
  for eq in
    select e.id,e.item_name,e.used_by_user_id,p.full_name,p.status
    from public.production_equipment e left join public.profiles p on p.id=e.used_by_user_id
    where e.production_id=p_production_id and e.id=any(p_equipment_ids)
    order by e.created_at,e.id for share of e
  loop
    if eq.used_by_user_id is null or eq.full_name is null or eq.status <> 'ACTIVE'
      or nullif(public.nas_folder_slug(eq.item_name),'') is null
      or nullif(public.nas_folder_slug(eq.full_name),'') is null then
      raise exception 'Completá el nombre del equipo y un operador activo en Equipamiento.';
    end if;
    select value into old_entry from jsonb_array_elements(all_entries) where value->>'equipmentId'=eq.id::text;
    if found then
      if old_entry->>'operatorId' <> eq.used_by_user_id::text then
        raise exception 'Un equipo ya tiene carpeta asignada a otro operador. Agregá una asignación nueva para conservar ambos aportes.';
      end if;
      entry := old_entry;
    else
      entry := jsonb_build_object('equipmentId',eq.id,'itemName',eq.item_name,
        'operatorId',eq.used_by_user_id,'operatorName',eq.full_name,
        'folderName',lpad((jsonb_array_length(all_entries)+1)::text,3,'0') || '_'
          || public.nas_folder_slug(eq.item_name) || '_' || public.nas_folder_slug(eq.full_name));
      all_entries := all_entries || jsonb_build_array(entry);
      changed := true;
    end if;
    selected_entries := selected_entries || jsonb_build_array(entry);
  end loop;
  if jsonb_array_length(all_entries)>100 then raise exception 'Se alcanzó el límite de 100 carpetas por producción.'; end if;
  snapshot := md5(jsonb_build_object('root',root,'entries',all_entries,'selected',selected_entries)::text);
  if p_confirm then
    if p_snapshot is distinct from snapshot then
      raise exception 'La vista previa cambió. Revisala de nuevo antes de confirmar.';
    end if;
    if not has_plan then
      insert into public.nas_folder_plans(production_id,capture_date,daily_number,root_name,entries,created_by)
      values(p_production_id,day,number,root,all_entries,auth.uid()) returning * into plan;
    elsif changed or plan.state='ERROR' then
      update public.nas_folder_plans set entries=all_entries,revision=revision+1,state='PENDING',last_error=null,prepared_at=null
      where id=plan.id returning * into plan;
    end if;
  end if;
  return jsonb_build_object('rootName',root,'entries',selected_entries,'snapshot',snapshot,
    'state',case when p_confirm then plan.state else coalesce(plan.state,'PREVIEW') end,
    'existing',has_plan,'preparedAt',plan.prepared_at);
end;
$$;
revoke all on function public.prepare_nas_folders(uuid,uuid[],boolean,text) from public, anon;
grant execute on function public.prepare_nas_folders(uuid,uuid[],boolean,text) to authenticated;
commit;
