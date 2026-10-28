import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ARGENTINA_TIME_ZONE, displayTimeZone } from "@/utils/dates";
import { folderProgress, type NasEntry } from "@/utils/nas-downloads";
import { SearchBox } from "@/app/search-box";

import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  HardDrive,
  PackageCheck,
  Video,
  WandSparkles,
} from "lucide-react";

// Dashboard: resumen real de la operación. Cada usuario ve lo que sus permisos (RLS) le permiten ver.

const CLOSED_PIECE = ["APPROVED", "DELIVERED", "OUT_OF_SCOPE"];
const CLOSED_PRODUCTION = ["COMPLETED", "NOT_COMPLETED", "CANCELLED"];
const OPEN_REQUEST = ["NEW", "IN_DEFINITION", "WAITING_CLIENT"];
const REVIEW = ["COORDINATOR_REVIEW", "INTERNAL_REVIEW", "CLIENT_REVIEW"];
const DAY_MS = 24 * 60 * 60 * 1000;

type Item = { key: string; date: string | null; kind: string; title: string; detail?: string; href: string };

function relationName(relation: unknown): string | undefined {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value && typeof value === "object" && "name" in value ? String((value as { name: unknown }).name ?? "") : undefined;
}

// Día de hoy en Argentina (AAAA-MM-DD), sin depender de la hora del servidor.
function argentinaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ARGENTINA_TIME_ZONE }).format(new Date());
}

function formatWhen(value: string | null) {
  if (!value) return "Sin fecha";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleString("es-AR", {
    timeZone: displayTimeZone(value),
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

// Primero lo que tiene fecha (más antiguo primero); al final lo que no tiene fecha.
function byDate(a: Item, b: Item) {
  const ta = a.date ? new Date(a.date).getTime() : Infinity;
  const tb = b.date ? new Date(b.date).getTime() : Infinity;
  return ta - tb;
}

function pieceHref(piece: { id: string; job_id: string | null }) {
  return piece.job_id ? `/trabajos/${piece.job_id}/entregables/${piece.id}` : "/edicion";
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = argentinaToday();
  const todayStart = new Date(`${today}T00:00:00-03:00`).getTime();
  const todayEnd = todayStart + DAY_MS;

  const [
    profileResult,
    rolesResult,
    piecesResult,
    productionsResult,
    plansResult,
    pendingResult,
    feedbackResult,
    requestsResult,
    filingsResult,
    detectionsResult,
    eventsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("user_roles").select("roles ( name )").eq("user_id", user.id),
    supabase
      .from("deliverables")
      .select("id,job_id,name,status,deadline,jobs:job_id ( name )")
      .not("status", "in", `(${CLOSED_PIECE.map((s) => `"${s}"`).join(",")})`),
    supabase
      .from("productions")
      .select("id,name,status,start_at,preparation_review_at,location")
      .not("status", "in", `(${CLOSED_PRODUCTION.map((s) => `"${s}"`).join(",")})`),
    supabase
      .from("nas_folder_plans")
      .select("id,production_id,state,entries,nas_folder_downloads ( equipment_id ),productions:production_id ( name )"),
    supabase
      .from("pending_items")
      .select("id,description,due_at,job_id")
      .eq("status", "PENDING"),
    supabase.from("feedback_items").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase
      .from("requests")
      .select("id,title,next_followup_at,status")
      .in("status", OPEN_REQUEST)
      .not("next_followup_at", "is", null)
      .lte("next_followup_at", nowIso),
    // Si la actualización "material acomodado" no está instalada, esta consulta falla y se ignora.
    supabase.from("nas_material_filings").select("plan_id"),
    // Carpetas creadas a mano en Backup, detectadas por el NAS y sin vincular a una producción.
    supabase
      .from("nas_material_detections")
      .select("id", { count: "exact", head: true })
      .eq("link_status", "UNLINKED"),
    // Reuniones y eventos del calendario (si la actualización del calendario no está instalada, se ignora).
    supabase
      .from("events")
      .select("id,title,start_at,location,status")
      .eq("status", "SCHEDULED")
      .gte("start_at", nowIso)
      .lte("start_at", new Date(now.getTime() + 7 * DAY_MS).toISOString()),
  ]);
  const unlinkedDetections = detectionsResult.error ? 0 : detectionsResult.count ?? 0;

  const loadError = [piecesResult, productionsResult, pendingResult, requestsResult].some((r) => r.error);

  const profile = profileResult.data;
  const roleNames =
    rolesResult.data
      ?.map((item: any) => item.roles?.name)
      .filter(Boolean) ?? [];

  const displayRole =
    roleNames.includes("COORDINACION")
      ? "Coordinación"
      : roleNames.includes("RESPONSABLE_PROYECTO")
      ? "Responsable de proyecto"
      : roleNames.includes("PRODUCCION")
      ? "Producción"
      : roleNames.includes("ADMINISTRACION")
      ? "Administración"
      : roleNames.includes("EDITOR")
      ? "Edición"
      : roleNames.includes("FREELANCE")
      ? "Freelance"
      : "Usuario";


  const pieces = piecesResult.data ?? [];
  const productions = productionsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const pendingItems = pendingResult.data ?? [];
  const requests = requestsResult.data ?? [];

  const time = (value: string | null) => (value ? new Date(value).getTime() : NaN);
  const inWeek = (value: string | null) => time(value) >= now.getTime() && time(value) <= now.getTime() + 7 * DAY_MS;
  const isPast = (value: string | null) => time(value) < now.getTime();
  const isToday = (value: string | null) => time(value) >= todayStart && time(value) < todayEnd;

  // Métricas
  const productionsWeek = productions.filter((p) => inWeek(p.start_at));
  const productionsToday = productions.filter((p) => isToday(p.start_at));
  const piecesWeek = pieces.filter((p) => inWeek(p.deadline));
  const overduePieces = pieces.filter((p) => isPast(p.deadline));
  const readyPieces = pieces.filter((p) => p.status === "READY_POST");
  const editingPieces = pieces.filter((p) => p.status === "EDITING" || p.status === "CORRECTIONS");
  const reviewPieces = pieces.filter((p) => REVIEW.includes(p.status));
  const overduePending = pendingItems.filter((p) => isPast(p.due_at));
  const upcomingProductions = productions.filter((p) => time(p.start_at) >= now.getTime());

  const planStatus = plans.map((plan) => {
    const progress = folderProgress((plan.entries ?? []) as NasEntry[], plan.nas_folder_downloads ?? []);
    return { plan, progress, name: relationName(plan.productions) ?? "Producción" };
  });
  const pendingDownloads = planStatus.filter(
    ({ plan, progress }) => plan.state === "READY" && progress.total > 0 && progress.completed < progress.total
  );
  const filedPlanIds = new Set((filingsResult.error ? [] : filingsResult.data ?? []).map((row) => row.plan_id as string));
  const unfiledMaterial = filingsResult.error
    ? []
    : planStatus.filter(
        ({ plan, progress }) =>
          plan.state === "READY" && progress.total > 0 && progress.completed === progress.total && !filedPlanIds.has(plan.id)
      );

  // Requieren atención
  const attention: Item[] = [
    ...overduePieces.map((p) => ({
      key: `piece-${p.id}`,
      date: p.deadline,
      kind: "Pieza vencida",
      title: p.name,
      detail: relationName(p.jobs),
      href: pieceHref(p),
    })),
    ...productions
      .filter((p) => isPast(p.preparation_review_at) && p.status !== "READY")
      .map((p) => ({
        key: `prep-${p.id}`,
        date: p.preparation_review_at,
        kind: "Revisión de preparación vencida",
        title: p.name,
        href: `/producciones/${p.id}`,
      })),
    ...planStatus
      .filter(({ plan }) => plan.state === "ERROR")
      .map(({ plan, name }) => ({
        key: `nas-error-${plan.production_id}`,
        date: null,
        kind: "Error al preparar carpetas NAS",
        title: name,
        href: `/producciones/${plan.production_id}/carpeta-nas`,
      })),
    ...pendingDownloads.map(({ plan, progress, name }) => ({
      key: `nas-${plan.production_id}`,
      date: null,
      kind: "Descargas pendientes",
      title: name,
      detail: `${progress.completed} de ${progress.total} carpetas confirmadas`,
      href: `/producciones/${plan.production_id}/carpeta-nas`,
    })),
    ...unfiledMaterial.map(({ plan, name }) => ({
      key: `filing-${plan.production_id}`,
      date: null,
      kind: "Material sin acomodar en la carpeta del cliente",
      title: name,
      href: `/producciones/${plan.production_id}/carpeta-nas`,
    })),
    ...(unlinkedDetections > 0
      ? [
          {
            key: "nas-detections",
            date: null,
            kind: "Carpetas creadas a mano en el NAS, sin vincular a una producción",
            title: `${unlinkedDetections} ${unlinkedDetections === 1 ? "carpeta detectada" : "carpetas detectadas"}`,
            href: "/producciones/material-nas",
          },
        ]
      : []),
    ...overduePending.map((p) => ({
      key: `pending-${p.id}`,
      date: p.due_at,
      kind: "Pendiente vencido",
      title: p.description ?? "Pendiente",
      href: p.job_id ? `/trabajos/${p.job_id}` : "/trabajos",
    })),
    ...requests.map((r) => ({
      key: `request-${r.id}`,
      date: r.next_followup_at,
      kind: "Seguimiento de solicitud",
      title: r.title,
      href: `/solicitudes/${r.id}`,
    })),
  ].sort(byDate);

  const feedbackCount = feedbackResult.count ?? 0;

  // Próximos 7 días
  const agenda: Item[] = [
    ...productionsWeek.map((p) => ({
      key: `prod-${p.id}`,
      date: p.start_at,
      kind: "Producción",
      title: p.name,
      detail: p.location ?? undefined,
      href: `/producciones/${p.id}`,
    })),
    ...(eventsResult.error ? [] : eventsResult.data ?? []).map((e) => ({
      key: `event-${e.id}`,
      date: e.start_at,
      kind: "Reunión",
      title: e.title,
      detail: e.location ?? undefined,
      href: `/calendario/eventos/${e.id}`,
    })),
    ...piecesWeek.map((p) => ({
      key: `deadline-${p.id}`,
      date: p.deadline,
      kind: "Entrega",
      title: p.name,
      detail: relationName(p.jobs),
      href: pieceHref(p),
    })),
  ].sort(byDate);

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div>
        <section className="min-w-0">
          <div className="border-b border-white/10 px-5 py-5 md:px-8">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Hola, {(profile?.full_name ?? "").split(" ")[0] || "equipo"}</h1>
                <p className="mt-1 text-sm text-zinc-500">Resumen operativo de AeroPro · {displayRole}</p>
              </div>
              <SearchBox action="/buscar" query="" placeholder="Buscar en todo..." label="Buscar en toda la plataforma" />
            </div>
          </div>

          <div className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 md:py-8">
            {loadError && (
              <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">
                Parte de la información no se pudo cargar. Refrescá la página; si sigue igual, avisá.
              </div>
            )}

            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#20A4DD]">
                    {formatWhen(`${today}`)}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Panorama operativo</h2>
                </div>
                <p className="hidden text-sm text-zinc-600 md:block">Próximos 7 días y lo que requiere atención</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  href="/producciones"
                  label="Producciones"
                  value={productionsWeek.length}
                  description={`en 7 días · ${productionsToday.length} hoy`}
                  icon={<Video size={20} />}
                />
                <StatCard
                  href="/edicion"
                  label="Entregas"
                  value={piecesWeek.length}
                  description={`vencen en 7 días · ${overduePieces.length} vencidas`}
                  icon={<PackageCheck size={20} />}
                  danger={overduePieces.length > 0}
                />
                <StatCard
                  href="/edicion"
                  label="Listas para edición"
                  value={readyPieces.length}
                  description="esperando asignar editor"
                  icon={<WandSparkles size={20} />}
                />
                <StatCard
                  href="/trabajos"
                  label="Pendientes"
                  value={pendingItems.length}
                  description={`abiertos · ${overduePending.length} vencidos`}
                  icon={<ClipboardList size={20} />}
                  danger={overduePending.length > 0}
                />
              </div>
            </section>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Requieren atención"
                subtitle={
                  feedbackCount > 0
                    ? `Alertas operativas · ${feedbackCount} feedback de cliente sin resolver`
                    : "Alertas y pendientes operativos"
                }
              >
                {attention.length === 0 ? (
                  <EmptyState title="Todo bajo control" text="No hay alertas ni pendientes vencidos en este momento." />
                ) : (
                  <ItemList items={attention} limit={12} showKindAsAlert />
                )}
              </Panel>

              <Panel title="Próximos 7 días" subtitle="Producciones, reuniones y entregas">
                {agenda.length === 0 ? (
                  <EmptyState
                    title="Sin actividades próximas"
                    text="Las producciones y entregas de los próximos 7 días aparecerán acá."
                  />
                ) : (
                  <ItemList items={agenda} limit={12} />
                )}
              </Panel>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Panel title="Edición" subtitle="Estado general de postproducción" href="/edicion">
                <div className="grid grid-cols-3 gap-3">
                  <MiniMetric label="Listas para asignar" value={readyPieces.length} />
                  <MiniMetric label="En edición o correcciones" value={editingPieces.length} />
                  <MiniMetric label="En revisión" value={reviewPieces.length} />
                </div>
              </Panel>

              <Panel title="Producción y material" subtitle="Rodajes y carpetas del NAS" href="/producciones">
                <div className="grid grid-cols-3 gap-3">
                  <MiniMetric label="Descargas pendientes" value={pendingDownloads.length} />
                  <MiniMetric label="Sin acomodar" value={unfiledMaterial.length} />
                  <MiniMetric label="Próximas producciones" value={upcomingProductions.length} />
                </div>
              </Panel>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  href,
  label,
  value,
  description,
  icon,
  danger,
}: {
  href: string;
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Link href={href} className="rounded-xl border border-white/10 bg-[#0B0F12] p-5 transition hover:border-white/20">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
          {icon}
        </div>
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
      </div>
      <p className="mt-6 text-sm font-medium">{label}</p>
      <p className={`mt-1 text-xs ${danger ? "text-red-400" : "text-zinc-600"}`}>{description}</p>
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0B0F12]">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>
        </div>
        {href && (
          <Link href={href} className="text-xs text-[#45B8E8] hover:underline">
            Ver →
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ItemList({ items, limit, showKindAsAlert }: { items: Item[]; limit: number; showKindAsAlert?: boolean }) {
  const shown = items.slice(0, limit);
  return (
    <div>
      <ul className="divide-y divide-white/5">
        {shown.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="flex items-start gap-3 py-2.5 transition hover:text-[#45B8E8]">
              <span className={`mt-0.5 shrink-0 ${showKindAsAlert ? "text-amber-400" : "text-zinc-600"}`}>
                {showKindAsAlert ? <AlertTriangle size={15} /> : item.kind === "Producción" ? <Video size={15} /> : <CalendarClock size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-200">{item.title}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {item.kind}
                  {item.detail ? ` · ${item.detail}` : ""}
                </span>
              </span>
              {item.date && <span className="shrink-0 text-xs text-zinc-500">{formatWhen(item.date)}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > limit && <p className="mt-3 text-xs text-zinc-600">Y {items.length - limit} más.</p>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-5 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
        <HardDrive size={17} />
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">{text}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#07090B] p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
