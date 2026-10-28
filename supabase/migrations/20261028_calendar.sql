-- Calendario: reuniones/eventos en la plataforma y sincronización hacia Google Calendar (producciones + eventos).
-- Ejecutar UNA sola vez, después de 20261028_profile_theme.sql. La tabla events está vacía: las reglas nuevas no afectan datos.
begin;

-- 1. Valores válidos de eventos (no tenían reglas).
alter table public.events
  add constraint events_type_check check (event_type in ('MEETING', 'CLIENT_MEETING', 'VISIT', 'OTHER')),
  add constraint events_status_check check (status in ('SCHEDULED', 'DONE', 'CANCELLED')),
  add constraint events_dates_check check (end_at >= start_at),
  add constraint events_title_check check (length(btrim(title)) > 0);
alter table public.event_participants
  add constraint event_participants_who_check check (user_id is not null or length(btrim(coalesce(external_name, ''))) > 0);
create index if not exists events_start_idx on public.events (start_at);
create index if not exists event_participants_event_idx on public.event_participants (event_id);

-- 2. Las producciones también guardan su sincronización con Google.
alter table public.productions
  add column google_event_id text,
  add column google_synced_at timestamptz;

-- 3. Permisos: todos los usuarios activos ven el calendario; crean/editan/borran reuniones
--    Coordinación, Administración, Producción, Responsable de proyecto y Edición (no Freelance).
create function public.can_edit_calendar()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE')
     and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                  where ur.user_id = auth.uid()
                    and r.name in ('COORDINACION', 'ADMINISTRACION', 'PRODUCCION', 'RESPONSABLE_PROYECTO', 'EDITOR'));
$$;
revoke all on function public.can_edit_calendar() from public, anon;
grant execute on function public.can_edit_calendar() to authenticated;

create function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE');
$$;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

revoke all on public.events, public.event_participants from anon;
grant select, insert, update, delete on public.events, public.event_participants to authenticated;

create policy events_read on public.events for select to authenticated using (public.is_active_user());
create policy events_insert on public.events for insert to authenticated with check (public.can_edit_calendar());
create policy events_update on public.events for update to authenticated
  using (public.can_edit_calendar()) with check (public.can_edit_calendar());
create policy events_delete on public.events for delete to authenticated using (public.can_edit_calendar());

create policy event_participants_read on public.event_participants for select to authenticated using (public.is_active_user());
create policy event_participants_insert on public.event_participants for insert to authenticated with check (public.can_edit_calendar());
create policy event_participants_update on public.event_participants for update to authenticated
  using (public.can_edit_calendar()) with check (public.can_edit_calendar());
create policy event_participants_delete on public.event_participants for delete to authenticated using (public.can_edit_calendar());

-- 4. Cola de sincronización con Google: cada cambio relevante deja un pedido; el servidor lo procesa.
create table public.calendar_sync_queue (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('production', 'event')),
  entity_id uuid not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
alter table public.calendar_sync_queue enable row level security;
revoke all on public.calendar_sync_queue from anon, authenticated;
grant all on public.calendar_sync_queue to service_role;
grant usage, select on sequence public.calendar_sync_queue_id_seq to service_role;
create index calendar_sync_pending_idx on public.calendar_sync_queue (id) where processed_at is null;

create function public.enqueue_calendar_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  kind text;
  target uuid;
begin
  if TG_TABLE_NAME = 'productions' then
    kind := 'production';
    if TG_OP = 'UPDATE' and (NEW.name, NEW.start_at, NEW.end_at, NEW.location, NEW.status, NEW.responsible_user_id, NEW.description)
       is not distinct from (OLD.name, OLD.start_at, OLD.end_at, OLD.location, OLD.status, OLD.responsible_user_id, OLD.description) then
      return null; -- solo cambió algo que no se ve en Google (por ejemplo, la marca de sincronización)
    end if;
    target := coalesce(NEW.id, OLD.id);
  elsif TG_TABLE_NAME = 'events' then
    kind := 'event';
    if TG_OP = 'UPDATE' and (NEW.title, NEW.event_type, NEW.start_at, NEW.end_at, NEW.location, NEW.description, NEW.status)
       is not distinct from (OLD.title, OLD.event_type, OLD.start_at, OLD.end_at, OLD.location, OLD.description, OLD.status) then
      return null;
    end if;
    target := coalesce(NEW.id, OLD.id);
  else -- event_participants: los participantes van en la descripción del evento
    kind := 'event';
    target := coalesce(NEW.event_id, OLD.event_id);
  end if;
  insert into public.calendar_sync_queue (entity_type, entity_id) values (kind, target);
  return null;
end;
$$;
revoke all on function public.enqueue_calendar_sync() from public, anon, authenticated;

create trigger calendar_sync after insert or update or delete on public.productions
  for each row execute function public.enqueue_calendar_sync();
create trigger calendar_sync after insert or update or delete on public.events
  for each row execute function public.enqueue_calendar_sync();
create trigger calendar_sync after insert or update or delete on public.event_participants
  for each row execute function public.enqueue_calendar_sync();

-- Estado para la pantalla Calendario (solo cantidades y último error; sin datos sensibles).
create function public.calendar_sync_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pending', (select count(*) from public.calendar_sync_queue where processed_at is null),
    'last_error', (select last_error from public.calendar_sync_queue
                    where processed_at is null and last_error is not null order by id desc limit 1),
    'last_sync', (select max(processed_at) from public.calendar_sync_queue)
  ) where public.is_active_user();
$$;
revoke all on function public.calendar_sync_status() from public, anon;
grant execute on function public.calendar_sync_status() to authenticated;

-- 5. Actividad: las marcas internas de sincronización con Google no se registran como cambios.
create or replace function public.log_activity()
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
     where n.key not in ('updated_at', 'google_event_id', 'google_calendar_id', 'google_synced_at')
       and (old_row -> n.key) is distinct from n.value;
    if diff is null then return null; end if;
  elsif TG_OP = 'INSERT' then
    diff := new_row - 'created_at' - 'updated_at';
  else
    diff := old_row;
  end if;

  if actor is not null then
    select full_name into actor_name from public.profiles where id = actor;
  end if;

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
         'plan_id', row_data -> 'plan_id', 'user_id', row_data -> 'user_id',
         'event_id', row_data -> 'event_id')), '{}'::jsonb),
       pg_trigger_depth() > 1);
  exception when others then
    raise warning 'activity_history: no se pudo registrar % en %: %', TG_OP, TG_TABLE_NAME, sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.log_activity() from public, anon, authenticated;

create trigger log_activity after insert or update or delete on public.event_participants
  for each row execute function public.log_activity();

-- 6. Producciones existentes con fecha: se encolan para crearlas en Google cuando se active la conexión.
insert into public.calendar_sync_queue (entity_type, entity_id)
select 'production', id from public.productions where start_at is not null;

commit;
