-- Historial de actividad: registra automáticamente quién crea, cambia o borra registros.
-- Ejecutar UNA sola vez en Supabase SQL Editor, después de las migraciones NAS ya aplicadas.
-- No modifica datos existentes, no toca el NAS y no cambia permisos de las tablas de negocio.
-- Solo Coordinación y Administración pueden leer el historial; nadie puede escribirlo ni borrarlo desde la plataforma.
begin;

-- 1. Columnas nuevas en la tabla existente (estaba vacía y sin uso).
alter table public.activity_history
  add column changes jsonb,              -- qué cambió: {campo: {antes, despues}} o la fila completa al crear/borrar
  add column context jsonb,              -- ids relacionados (trabajo, producción, proyecto...) para armar links
  add column performed_by_name text,     -- nombre de la persona en ese momento ("Sistema" si fue el NAS u otro proceso)
  add column is_automatic boolean not null default false; -- true si lo hizo un automatismo disparado por otra acción

create index activity_history_created_idx on public.activity_history (created_at desc);
create index activity_history_entity_idx on public.activity_history (entity_type, entity_id, created_at desc);
create index activity_history_user_idx on public.activity_history (performed_by_user_id, created_at desc);

-- 2. Permisos: solo lectura, y solo para Coordinación/Administración activos.
revoke all on public.activity_history from anon, authenticated;
grant select on public.activity_history to authenticated;
grant all on public.activity_history to service_role;

create function public.can_view_activity()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE')
     and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                  where ur.user_id = auth.uid() and r.name in ('COORDINACION', 'ADMINISTRACION'));
$$;
revoke all on function public.can_view_activity() from public, anon;
grant execute on function public.can_view_activity() to authenticated;

create policy activity_history_read on public.activity_history
  for select to authenticated using (public.can_view_activity());

-- 3. Registro automático. Argumento opcional: columna que identifica el registro (por defecto "id").
create function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  id_column text := coalesce(TG_ARGV[0], 'id');
  old_row jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  new_row jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
  row_data jsonb := coalesce(new_row, old_row);
  target uuid;
  diff jsonb;
  actor uuid := auth.uid();
  actor_name text;
begin
  begin
    target := (row_data ->> id_column)::uuid;
  exception when others then
    return null;
  end;
  if target is null then return null; end if;

  if TG_OP = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('antes', old_row -> n.key, 'despues', n.value))
      into diff
      from jsonb_each(new_row) n
     where n.key <> 'updated_at' and (old_row -> n.key) is distinct from n.value;
    if diff is null then return null; end if; -- guardar sin cambios reales no se registra
  elsif TG_OP = 'INSERT' then
    diff := new_row - 'created_at' - 'updated_at';
  else
    diff := old_row;
  end if;

  if actor is not null then
    select full_name into actor_name from public.profiles where id = actor;
  end if;

  -- El historial nunca debe impedir el trabajo: si fallara el registro, la acción sigue igual.
  begin
    insert into public.activity_history
      (entity_type, entity_id, action, description, performed_by_user_id, performed_by_name,
       changes, context, is_automatic)
    values
      (TG_TABLE_NAME, target, TG_OP,
       coalesce(row_data ->> 'name', row_data ->> 'title', row_data ->> 'full_name',
                row_data ->> 'root_name', row_data ->> 'summary', left(row_data ->> 'description', 120)),
       actor, coalesce(actor_name, case when actor is null then 'Sistema' end),
       diff,
       nullif(jsonb_strip_nulls(jsonb_build_object(
         'job_id', row_data -> 'job_id', 'production_id', row_data -> 'production_id',
         'project_id', row_data -> 'project_id', 'client_id', row_data -> 'client_id',
         'request_id', row_data -> 'request_id', 'deliverable_id', row_data -> 'deliverable_id',
         'plan_id', row_data -> 'plan_id', 'user_id', row_data -> 'user_id')), '{}'::jsonb),
       pg_trigger_depth() > 1);
  exception when others then
    raise warning 'activity_history: no se pudo registrar % en %: %', TG_OP, TG_TABLE_NAME, sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.log_activity() from public, anon, authenticated;

-- 4. Tablas registradas. Se omiten catálogos fijos y la detección automática del NAS (corre cada 5 minutos).
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('clients', null), ('projects', null), ('requests', null), ('request_followups', null),
      ('jobs', null), ('deliverable_groups', null), ('deliverables', null), ('deliverable_versions', null),
      ('client_sends', null), ('feedback_items', null), ('scope_changes', null), ('pending_items', null),
      ('productions', null), ('production_jobs', 'production_id'), ('production_participants', null),
      ('production_external_participants', null), ('production_equipment', null),
      ('production_checklist_items', null), ('nas_folder_plans', null), ('nas_folder_downloads', 'plan_id'),
      ('editing_sessions', null), ('material_downloads', null), ('material_backups', null),
      ('events', null), ('minutes', null), ('comments', null), ('attachments', null),
      ('administrative_items', null), ('profiles', null), ('user_roles', 'user_id')
    ) as t(table_name, id_column)
  loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I for each row execute function public.log_activity(%s)',
      item.table_name,
      coalesce(quote_literal(item.id_column), ''));
  end loop;
end $$;

commit;
