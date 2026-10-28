import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ARGENTINA_TIME_ZONE } from "@/utils/dates";

// Historial de actividad: solo lectura. Lo ven Coordinación y Administración (lo controla la base).

type ActivityRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: "INSERT" | "UPDATE" | "DELETE" | string;
  description: string | null;
  performed_by_user_id: string | null;
  performed_by_name: string | null;
  changes: Record<string, unknown> | null;
  context: Record<string, string> | null;
  is_automatic: boolean;
  created_at: string;
};

type Filters = { persona?: string; tipo?: string; desde?: string; hasta?: string; limite?: string; trabajo?: string; produccion?: string };

const ENTITY_LABELS: Record<string, string> = {
  clients: "Cliente", projects: "Proyecto", requests: "Solicitud", request_followups: "Seguimiento de solicitud",
  jobs: "Trabajo", deliverable_groups: "Grupo de piezas", deliverables: "Pieza", deliverable_versions: "Versión",
  client_sends: "Envío al cliente", feedback_items: "Feedback", scope_changes: "Cambio de alcance",
  pending_items: "Pendiente", productions: "Producción", production_jobs: "Vínculo producción-trabajo",
  production_participants: "Participante", production_external_participants: "Participante externo",
  production_equipment: "Equipamiento", production_checklist_items: "Checklist", nas_folder_plans: "Carpetas NAS",
  nas_folder_downloads: "Descarga de carpeta", nas_material_filings: "Material acomodado", editing_sessions: "Sesión de edición",
  material_downloads: "Descarga (anterior)", material_backups: "Backup (anterior)", events: "Evento",
  minutes: "Minuta", comments: "Comentario", attachments: "Adjunto", administrative_items: "Ítem administrativo",
  profiles: "Usuario", user_roles: "Rol de usuario",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Estado", name: "Nombre", title: "Título", full_name: "Nombre", description: "Descripción",
  notes: "Notas", deadline: "Vencimiento", general_deadline: "Vencimiento general", start_at: "Inicio",
  end_at: "Fin", location: "Lugar", editor_user_id: "Editor", responsible_user_id: "Responsable",
  main_responsible_user_id: "Responsable", urgent: "Urgente", queue_position: "Posición en cola",
  target_first_cut_at: "Primer corte previsto", actual_first_cut_at: "Primer corte real",
  current_version: "Versión actual", job_id: "Trabajo", production_id: "Producción", project_id: "Proyecto",
  client_id: "Cliente", preparation_review_at: "Revisión de preparación", nas_material_managed: "Material NAS",
  state: "Estado NAS", entries: "Carpetas", confirmed_by_name: "Confirmó", user_id: "Usuario", role_id: "Rol",
  drive_url: "Drive", next_followup_at: "Próximo seguimiento", filed_path: "Carpeta del cliente",
  cuenta: "Cuenta", usual_specialty: "Especialidad", availability: "Disponibilidad", theme: "Apariencia", avatar_url: "Foto",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo", INACTIVE: "Inactivo", PAUSED: "Pausado", CLOSED: "Cerrado",
  DEFINED: "Definida", PENDING_MATERIAL: "Pendiente material", READY_POST: "Lista para post",
  EDITING: "En edición", COORDINATOR_REVIEW: "Revisión coordinador", INTERNAL_REVIEW: "Revisión interna",
  CLIENT_REVIEW: "Revisión cliente", CORRECTIONS: "Correcciones", APPROVED: "Aprobada",
  DELIVERED: "Entregada", OUT_OF_SCOPE: "Fuera de alcance",
  PENDING_PLANNING: "Pendiente planificación", PENDING_DATE: "Pendiente fecha", SCHEDULED: "Programada",
  READY: "Lista", COMPLETED: "Completada", NOT_COMPLETED: "No realizada", CANCELLED: "Cancelada",
  PENDING: "Pendiente", RESOLVED: "Resuelto", NEW: "Nueva", CONFIRMED: "Confirmada",
  AVAILABLE: "Disponible", UNAVAILABLE: "No disponible", dark: "Oscuro", light: "Claro", system: "Automático",
};

const ACTION_LABELS: Record<string, string> = { INSERT: "creó", UPDATE: "modificó", DELETE: "borró" };

const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE_PROYECTO: "Responsable de proyecto", COORDINACION: "Coordinación", PRODUCCION: "Producción",
  ADMINISTRACION: "Administración", EDITOR: "Edición", FREELANCE: "Freelance",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARGENTINA_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

function nextDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatValue(value: unknown, people: Map<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") {
    if (UUID.test(value)) return people.get(value) ?? "(registro)";
    if (STATUS_LABELS[value]) return STATUS_LABELS[value];
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return dateTime.format(new Date(value));
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  if (Array.isArray(value)) return `${value.length} elemento${value.length === 1 ? "" : "s"}`;
  return String(value);
}

function entityHref(row: ActivityRow) {
  if (row.action === "DELETE") return null;
  const ctx = row.context ?? {};
  switch (row.entity_type) {
    case "clients": return `/clientes/${row.entity_id}`;
    case "projects": return `/proyectos/${row.entity_id}`;
    case "requests": return `/solicitudes/${row.entity_id}`;
    case "jobs": return `/trabajos/${row.entity_id}`;
    case "productions": return `/producciones/${row.entity_id}`;
    case "deliverables": return ctx.job_id ? `/trabajos/${ctx.job_id}/entregables/${row.entity_id}` : null;
    case "nas_folder_plans": return ctx.production_id ? `/producciones/${ctx.production_id}/carpeta-nas` : null;
    case "nas_material_filings": return null;
    case "profiles": return `/usuarios/${row.entity_id}`;
    case "user_roles": return `/usuarios/${row.entity_id}`;
    default:
      if (ctx.production_id) return `/producciones/${ctx.production_id}`;
      if (ctx.job_id) return `/trabajos/${ctx.job_id}`;
      return null;
  }
}

function ChangeSummary({ row, people }: { row: ActivityRow; people: Map<string, string> }) {
  if (row.action !== "UPDATE" || !row.changes) return null;
  const entries = Object.entries(row.changes) as [string, { antes?: unknown; despues?: unknown }][];
  const shown = entries.slice(0, 4);
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
      {shown.map(([field, change]) => (
        <li key={field}>
          <span className="text-zinc-400">{FIELD_LABELS[field] ?? field}:</span>{" "}
          {formatValue(change?.antes, people)} → <span className="text-zinc-300">{formatValue(change?.despues, people)}</span>
        </li>
      ))}
      {entries.length > shown.length && <li>y {entries.length - shown.length} campo(s) más</li>}
    </ul>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const filters = await searchParams;
  const persona = filters.persona && UUID.test(filters.persona) ? filters.persona : "";
  const tipo = filters.tipo && ENTITY_LABELS[filters.tipo] ? filters.tipo : "";
  const desde = filters.desde && DAY.test(filters.desde) ? filters.desde : "";
  const hasta = filters.hasta && DAY.test(filters.hasta) ? filters.hasta : "";
  const limite = Math.min(Math.max(Number(filters.limite) || 100, 100), 1000);
  const trabajo = filters.trabajo && UUID.test(filters.trabajo) ? filters.trabajo : "";
  const produccion = !trabajo && filters.produccion && UUID.test(filters.produccion) ? filters.produccion : "";

  const { data: allowed, error: permissionError } = await supabase.rpc("can_view_activity");

  const header = (
    <div className="mb-8">
      <Link href="/usuarios" className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
        <ArrowLeft size={16} /> Volver a Usuarios
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
          <History size={21} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
          <p className="mt-1 text-sm text-zinc-500">Quién creó, modificó o borró cada cosa, y cuándo. Solo lectura.</p>
        </div>
      </div>
    </div>
  );

  if (permissionError || !allowed) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
          {header}
          <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-6 text-sm text-zinc-400">
            {permissionError
              ? "El historial de actividad todavía no está activado en la base de datos."
              : "El historial de actividad solo está disponible para Coordinación y Administración."}
          </div>
        </div>
      </main>
    );
  }

  // Actividad de un trabajo o producción: el registro y todo lo que se le relaciona.
  let scopeFilter = "";
  let scopeTitle = "";
  let scopeHref = "";
  if (trabajo) {
    const [{ data: job }, { data: pieces }] = await Promise.all([
      supabase.from("jobs").select("name").eq("id", trabajo).maybeSingle(),
      supabase.from("deliverables").select("id").eq("job_id", trabajo),
    ]);
    const pieceIds = (pieces ?? []).map((piece) => piece.id as string);
    scopeFilter = [
      `entity_id.eq.${trabajo}`,
      `context->>job_id.eq.${trabajo}`,
      ...(pieceIds.length ? [`entity_id.in.(${pieceIds.join(",")})`, `context->>deliverable_id.in.(${pieceIds.join(",")})`] : []),
    ].join(",");
    scopeTitle = `Trabajo: ${job?.name ?? "(ya no existe)"}`;
    scopeHref = `/trabajos/${trabajo}`;
  } else if (produccion) {
    const [{ data: production }, { data: plan }] = await Promise.all([
      supabase.from("productions").select("name").eq("id", produccion).maybeSingle(),
      supabase.from("nas_folder_plans").select("id").eq("production_id", produccion).maybeSingle(),
    ]);
    scopeFilter = [
      `entity_id.eq.${produccion}`,
      `context->>production_id.eq.${produccion}`,
      ...(plan?.id ? [`entity_id.eq.${plan.id}`, `context->>plan_id.eq.${plan.id}`] : []),
    ].join(",");
    scopeTitle = `Producción: ${production?.name ?? "(ya no existe)"}`;
    scopeHref = `/producciones/${produccion}`;
  }

  let query = supabase.from("activity_history")
    .select("id,entity_type,entity_id,action,description,performed_by_user_id,performed_by_name,changes,context,is_automatic,created_at")
    .order("created_at", { ascending: false })
    .limit(limite + 1);
  if (scopeFilter) query = query.or(scopeFilter);
  if (persona) query = query.eq("performed_by_user_id", persona);
  if (tipo) query = query.eq("entity_type", tipo);
  // Argentina usa UTC-3 todo el año.
  if (desde) query = query.gte("created_at", `${desde}T00:00:00-03:00`);
  if (hasta) query = query.lt("created_at", `${nextDay(hasta)}T00:00:00-03:00`);

  const [{ data, error }, { data: profiles }, { data: roleRows }] = await Promise.all([
    query,
    supabase.from("profiles").select("id,full_name").order("full_name", { ascending: true }),
    supabase.from("roles").select("id,name"),
  ]);

  // Nombres para mostrar ids de personas y de roles.
  const people = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.full_name as string]));
  for (const role of roleRows ?? []) people.set(role.id as string, ROLE_LABELS[role.name as string] ?? (role.name as string));
  const rows = ((data ?? []) as ActivityRow[]);
  const hasMore = rows.length > limite;
  const visible = rows.slice(0, limite);
  const moreParams = new URLSearchParams({ ...(persona && { persona }), ...(tipo && { tipo }), ...(desde && { desde }), ...(hasta && { hasta }), ...(trabajo && { trabajo }), ...(produccion && { produccion }), limite: String(limite + 100) });
  const filtering = Boolean(persona || tipo || desde || hasta || trabajo || produccion);
  const fieldClass = "h-10 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-white focus:border-[#20A4DD]/50 focus:outline-none";

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
        {header}

        {scopeTitle && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#20A4DD]/20 bg-[#20A4DD]/[0.05] px-4 py-3 text-sm">
            <span className="text-zinc-400">Mostrando solo:</span>
            <Link href={scopeHref} className="font-medium text-zinc-100 hover:text-[#45B8E8]">{scopeTitle}</Link>
            <Link href="/actividad" className="ml-auto text-xs text-[#45B8E8] hover:underline">Ver toda la actividad</Link>
          </div>
        )}

        <Form action="/actividad" className="mb-6 flex flex-wrap items-end gap-3">
          {trabajo && <input type="hidden" name="trabajo" value={trabajo} />}
          {produccion && <input type="hidden" name="produccion" value={produccion} />}
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Persona
            <select name="persona" defaultValue={persona} className={fieldClass}>
              <option value="">Todas</option>
              {(profiles ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Tipo
            <select name="tipo" defaultValue={tipo} className={fieldClass}>
              <option value="">Todos</option>
              {Object.entries(ENTITY_LABELS).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Desde
            <input type="date" name="desde" defaultValue={desde} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Hasta
            <input type="date" name="hasta" defaultValue={hasta} className={fieldClass} />
          </label>
          <button type="submit" className="h-10 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110">
            Filtrar
          </button>
          {filtering && <Link href="/actividad" className="h-10 content-center text-sm text-[#45B8E8] hover:underline">Quitar filtros</Link>}
        </Form>

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">No se pudo cargar la actividad.</div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-10 text-center text-sm text-zinc-400">
            {filtering ? "No hay actividad con esos filtros." : "Todavía no hay actividad registrada. Se empieza a registrar desde la activación del historial."}
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            {visible.map((row) => {
              const href = entityHref(row);
              // Roles: "agregó rol Edición · Persona" / "quitó rol ...".
              const isRole = row.entity_type === "user_roles";
              const roleId = isRole ? String((row.changes as Record<string, unknown> | null)?.role_id ?? "") : "";
              const what = isRole
                ? `${people.get(roleId) ?? "rol"} · ${people.get(row.entity_id) ?? "usuario"}`
                : row.description;
              return (
                <div key={row.id} className="grid gap-1 border-b border-white/5 px-5 py-3 text-sm last:border-b-0 md:grid-cols-[150px_200px_1fr]">
                  <div className="text-xs text-zinc-500 md:text-sm">{dateTime.format(new Date(row.created_at))}</div>
                  <div className="text-zinc-300">
                    {row.performed_by_name ?? "Desconocido"}
                    {row.is_automatic && (
                      <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">automático</span>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-500">
                      {isRole ? (row.action === "DELETE" ? "quitó" : "agregó") : ACTION_LABELS[row.action] ?? row.action}{" "}
                    </span>
                    <span className="text-zinc-400">{isRole ? "rol" : (ENTITY_LABELS[row.entity_type] ?? row.entity_type).toLowerCase()}</span>{" "}
                    {what && (href ? (
                      <Link href={href} className="font-medium text-zinc-100 hover:text-[#45B8E8]">{what}</Link>
                    ) : (
                      <span className="font-medium text-zinc-100">{what}</span>
                    ))}
                    {!what && href && (
                      <Link href={href} className="text-xs text-[#45B8E8] hover:underline">ver</Link>
                    )}
                    <ChangeSummary row={row} people={people} />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {hasMore && (
          <Link href={`/actividad?${moreParams.toString()}`} className="mt-4 inline-block text-sm text-[#45B8E8] hover:underline">
            Ver más →
          </Link>
        )}
      </div>
    </main>
  );
}
