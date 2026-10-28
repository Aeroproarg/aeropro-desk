-- LIMPIEZA DE DATOS DE PRUEBA — AeroPro Desk — 28/10/2026
-- NO es una migración. Ejecutar UNA sola vez en Supabase SQL Editor.
-- Todo o nada: si algo falla, no se aplica ningún cambio.
--
-- SE BORRA: cliente Cinter, proyecto Sidersa, la solicitud, los trabajos y TODO lo que cuelga de ellos
--   (piezas, grupos, versiones, envíos al cliente, feedback, pendientes) y la producción "Produccion prueba"
--   con su equipo, participantes, checklist y registros de material anteriores.
-- SE CONSERVA: usuarios y roles, catálogos, historial de Actividad, archivos del NAS y fotos de perfil.
-- Botania y Congreso Inmobiliario Rosario quedan como CANCELADAS (no se borran: su número de carpeta
--   NAS queda reservado para no chocar con las carpetas que ya existen en el Synology).
-- Las carpetas detectadas en el NAS se conservan; la vinculada a "Produccion prueba" vuelve a "sin vincular".
-- Solo se borra el registro de la detección de prueba "PRUEBA ENDPOINT" (la carpeta del NAS no se toca).
--
-- RESPALDO: antes de borrar, se copia cada tabla tal como está al esquema "respaldo_20261028".

begin;

-- 0. Respaldo completo de todas las tablas (no accesible desde la plataforma).
create schema respaldo_20261028;
do $$
declare
  t record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('create table respaldo_20261028.%I as table public.%I', t.table_name, t.table_name);
  end loop;
end $$;
revoke all on schema respaldo_20261028 from public, anon, authenticated;

-- 1. Producciones con carpeta NAS (Botania, Congreso Inmobiliario Rosario): Canceladas y sin trabajos.
update public.productions
   set status = 'CANCELLED', updated_at = now()
 where id in (select production_id from public.nas_folder_plans);
delete from public.production_jobs;

-- 2. Trabajos y todo lo que depende de ellos (piezas, grupos, versiones, envíos, feedback, pendientes).
delete from public.jobs;

-- 3. Solicitudes.
delete from public.requests;

-- 4. Producciones sin carpeta NAS ("Produccion prueba") y lo que depende de ellas.
--    Antes, las detecciones del NAS vinculadas a ellas vuelven a "sin vincular".
update public.nas_material_detections
   set link_status = 'UNLINKED', production_id = null, project_id = null
 where production_id in (
   select id from public.productions
    where id not in (select production_id from public.nas_folder_plans)
 );
delete from public.productions
 where id not in (select production_id from public.nas_folder_plans);

-- 5. Proyectos y clientes.
delete from public.projects;
delete from public.clients;

-- 6. Registro de la detección de prueba del endpoint (la carpeta del NAS no se toca).
delete from public.nas_material_detections
 where nas_path = '/Backup/2026-09-24/PRUEBA ENDPOINT';

commit;

-- 7. Verificación: cómo quedó cada tabla.
select 'clientes' as tabla, count(*) as filas from public.clients
union all select 'proyectos', count(*) from public.projects
union all select 'solicitudes', count(*) from public.requests
union all select 'trabajos', count(*) from public.jobs
union all select 'piezas', count(*) from public.deliverables
union all select 'producciones (todas canceladas)', count(*) from public.productions
union all select 'carpetas NAS reservadas', count(*) from public.nas_folder_plans
union all select 'detecciones NAS sin vincular', count(*) from public.nas_material_detections where link_status = 'UNLINKED'
union all select 'usuarios', count(*) from public.profiles
union all select 'tablas respaldadas', count(*) from information_schema.tables where table_schema = 'respaldo_20261028';
