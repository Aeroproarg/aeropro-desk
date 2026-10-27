-- Ejecutar una vez después de las dos migraciones de carpetas/descargas.
-- No mueve archivos, no asigna editores y no inicia ediciones.
begin;

alter table public.deliverables add column nas_material_managed boolean not null default false;

create function public.nas_production_material_ready(p_production_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.nas_folder_plans p
    where p.production_id=p_production_id and p.state='READY' and jsonb_array_length(p.entries)>0
    and not exists (
      select 1 from jsonb_array_elements(p.entries) e
      where not exists (select 1 from public.nas_folder_downloads d
        where d.plan_id=p.id and d.equipment_id::text=e->>'equipmentId')
    )
  );
$$;

create function public.nas_job_material_ready(p_job_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.production_jobs where job_id=p_job_id)
    and not exists (select 1 from public.production_jobs pj where pj.job_id=p_job_id
      and not public.nas_production_material_ready(pj.production_id));
$$;

create function public.nas_job_uses_folder_downloads(p_job_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.production_jobs pj join public.nas_folder_plans p
    on p.production_id=pj.production_id where pj.job_id=p_job_id);
$$;

create function public.sync_nas_job_readiness(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ready boolean; managed boolean;
begin
  if p_job_id is null then return; end if;
  -- Dos confirmaciones simultáneas del mismo trabajo se evalúan en orden.
  perform pg_advisory_xact_lock(hashtextextended('nas_job:' || p_job_id::text,0));
  ready := public.nas_job_material_ready(p_job_id);
  managed := public.nas_job_uses_folder_downloads(p_job_id);
  if ready then
    update public.deliverables set status='READY_POST',nas_material_managed=true,updated_at=now()
    where job_id=p_job_id and status in ('DEFINED','PENDING_MATERIAL','READY_POST')
      and (status<>'READY_POST' or not nas_material_managed);
  else
    update public.deliverables set status='PENDING_MATERIAL',nas_material_managed=true,updated_at=now()
    where job_id=p_job_id and status in ('DEFINED','PENDING_MATERIAL','READY_POST')
      and (managed or nas_material_managed)
      and (status<>'PENDING_MATERIAL' or not nas_material_managed);
  end if;
end;
$$;

create function public.nas_sync_production_jobs(p_production_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare linked_job uuid;
begin
  for linked_job in select distinct job_id from public.production_jobs
    where production_id=p_production_id order by job_id
  loop perform public.sync_nas_job_readiness(linked_job); end loop;
end;
$$;

create function public.nas_plan_readiness_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='DELETE' then
    perform public.nas_sync_production_jobs(OLD.production_id);
  else
    perform public.nas_sync_production_jobs(NEW.production_id);
  end if;
  return null;
end;
$$;
create trigger nas_plan_readiness_changed after insert or delete or update of entries,state
on public.nas_folder_plans for each row execute function public.nas_plan_readiness_changed();

create function public.nas_download_readiness_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare production uuid;
begin
  if TG_OP='DELETE' then
    select production_id into production from public.nas_folder_plans where id=OLD.plan_id;
  else
    select production_id into production from public.nas_folder_plans where id=NEW.plan_id;
  end if;
  perform public.nas_sync_production_jobs(production);
  return null;
end;
$$;
create trigger nas_download_readiness_changed after insert or delete
on public.nas_folder_downloads for each row execute function public.nas_download_readiness_changed();

create function public.nas_job_link_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare linked_job uuid; job_ids uuid[];
begin
  if TG_OP='INSERT' then job_ids:=array[NEW.job_id];
  elsif TG_OP='DELETE' then job_ids:=array[OLD.job_id];
  else job_ids:=array[OLD.job_id,NEW.job_id]; end if;
  for linked_job in select distinct x from unnest(job_ids) x order by x
  loop perform public.sync_nas_job_readiness(linked_job); end loop;
  return null;
end;
$$;
create trigger nas_job_link_changed after insert or delete or update of job_id,production_id
on public.production_jobs for each row execute function public.nas_job_link_changed();

create function public.nas_deliverable_material_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare managed boolean;
begin
  managed := public.nas_job_uses_folder_downloads(NEW.job_id) or NEW.nas_material_managed;
  if TG_OP='UPDATE' then managed := managed or OLD.nas_material_managed; end if;
  if not managed then return NEW; end if;
  NEW.nas_material_managed := true;
  if NEW.status in ('DEFINED','PENDING_MATERIAL','READY_POST') then
    if public.nas_job_material_ready(NEW.job_id) then NEW.status := 'READY_POST';
    else NEW.status := 'PENDING_MATERIAL'; end if;
  elsif NEW.status='EDITING' then
    if TG_OP='INSERT' then
      if not public.nas_job_material_ready(NEW.job_id) then
        raise exception 'Todavía falta material del trabajo. Actualizá la cola de edición.';
      end if;
    elsif OLD.status in ('DEFINED','PENDING_MATERIAL','READY_POST') then
      if not public.nas_job_material_ready(NEW.job_id) then
        raise exception 'Todavía falta material del trabajo. Actualizá la cola de edición.';
      end if;
    end if;
  end if;
  return NEW;
end;
$$;
create trigger nas_deliverable_material_guard before insert or update of status,job_id,nas_material_managed
on public.deliverables for each row execute function public.nas_deliverable_material_guard();

create function public.nas_deliverable_added()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.sync_nas_job_readiness(NEW.job_id);
  return null;
end;
$$;
create trigger nas_deliverable_added after insert or update of job_id
on public.deliverables for each row execute function public.nas_deliverable_added();

-- Solo triggers internos: usuarios y clientes no pueden invocar sincronización administrativa.
revoke all on function public.nas_production_material_ready(uuid) from public,anon,authenticated;
revoke all on function public.nas_job_material_ready(uuid) from public,anon,authenticated;
revoke all on function public.nas_job_uses_folder_downloads(uuid) from public,anon,authenticated;
revoke all on function public.sync_nas_job_readiness(uuid) from public,anon,authenticated;
revoke all on function public.nas_sync_production_jobs(uuid) from public,anon,authenticated;
revoke all on function public.nas_plan_readiness_changed() from public,anon,authenticated;
revoke all on function public.nas_download_readiness_changed() from public,anon,authenticated;
revoke all on function public.nas_job_link_changed() from public,anon,authenticated;
revoke all on function public.nas_deliverable_material_guard() from public,anon,authenticated;
revoke all on function public.nas_deliverable_added() from public,anon,authenticated;

-- Incluye material que ya fue confirmado antes de instalar esta actualización.
do $$ declare linked_job uuid;
begin
  for linked_job in select distinct pj.job_id from public.production_jobs pj
    join public.nas_folder_plans p on p.production_id=pj.production_id order by pj.job_id
  loop perform public.sync_nas_job_readiness(linked_job); end loop;
end $$;
commit;
