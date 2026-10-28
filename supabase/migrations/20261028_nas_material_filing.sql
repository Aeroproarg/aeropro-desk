-- Material acomodado en la carpeta del cliente: una confirmación manual por producción, con la ruta destino.
-- Ejecutar UNA sola vez, después de 20261028_activity_history.sql.
-- No mueve ni borra archivos del NAS: solo registra quién confirmó, cuándo y dónde quedó el material.
begin;

create table public.nas_material_filings (
  plan_id uuid primary key references public.nas_folder_plans(id),
  filed_path text not null check (length(btrim(filed_path)) between 3 and 500),
  filed_at timestamptz not null default now(),
  filed_by uuid not null references public.profiles(id),
  filed_by_name text not null,
  path_updated_at timestamptz,
  path_updated_by_name text
);
alter table public.nas_material_filings enable row level security;
revoke all on public.nas_material_filings from anon, authenticated;
grant select on public.nas_material_filings to authenticated;
grant all on public.nas_material_filings to service_role;

-- Lo ven las mismas personas que ven las carpetas NAS de la producción.
create policy nas_material_filings_read on public.nas_material_filings
for select to authenticated using (
  exists (select 1 from public.nas_folder_plans p
    where p.id = plan_id and public.can_prepare_nas(p.production_id))
);

create function public.confirm_nas_material_filing(p_plan_id uuid, p_path text)
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
  if not found or not public.can_prepare_nas(plan.production_id) then
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
revoke all on function public.confirm_nas_material_filing(uuid, text) from public, anon;
grant execute on function public.confirm_nas_material_filing(uuid, text) to authenticated;

-- Queda en el historial de actividad como el resto.
create trigger log_activity after insert or update or delete on public.nas_material_filings
  for each row execute function public.log_activity('plan_id');

commit;
