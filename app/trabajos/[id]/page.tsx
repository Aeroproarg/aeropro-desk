import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ActivityLink from "@/app/activity-link";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  Layers3,
  ListChecks,
  MessageSquareText,
  Pencil,
  Plus,
  UsersRound,
} from "lucide-react";

type JobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetailPage({
  params,
}: JobPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * TRABAJO
   * =====================================
   */

  const { data: job, error } = await supabase
    .from("jobs")
    .select(`
      id,
      name,
      status,
      original_brief,
      general_deadline,
      created_at,
      project_id,
      responsible_user_id,
      category_id,
      source_request_id,

      projects:project_id (
        id,
        name,
        clients:client_id (
          id,
          name
        )
      ),

      profiles:responsible_user_id (
        full_name
      ),

      job_categories:category_id (
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !job) {
    notFound();
  }

  /*
   * =====================================
   * DATOS RELACIONADOS
   * =====================================
   */

  const [
    pendingResult,
    productionsResult,
    deliverableGroupsResult,
    deliverablesResult,
    minutesResult,
    scopeChangesResult,
  ] = await Promise.all([
    /*
     * PENDIENTES
     */
    supabase
      .from("pending_items")
      .select(`
        id,
        description,
        status,
        due_at,
        is_next_step,
        blocks_editing
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

    /*
     * PRODUCCIONES
     */
    supabase
      .from("production_jobs")
      .select(`
        production_id,
        productions:production_id (
          id,
          name,
          status
        )
      `)
      .eq("job_id", id),

    /*
     * GRUPOS DE ENTREGABLES
     */
    supabase
      .from("deliverable_groups")
      .select(`
        id,
        name,
        type_id,
        quantity,
        status,
        common_properties,
        group_deadline,
        notes,
        created_at,

        deliverable_types:type_id (
          name
        )
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: true,
      }),

    /*
     * PIEZAS INDIVIDUALES
     */
    supabase
      .from("deliverables")
      .select(`
        id,
        group_id,
        name,
        type_id,
        properties,
        status,
        deadline,
        responsible_user_id,
        editor_user_id,
        target_first_cut_at,
        actual_first_cut_at,
        current_version,
        final_url,
        urgent,
        queue_position,
        created_at,

        deliverable_types:type_id (
          name
        ),

        profiles:responsible_user_id (
          full_name
        )
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: true,
      }),

    /*
     * MINUTAS
     */
    supabase
      .from("minutes")
      .select(`
        id,
        title,
        date
      `)
      .eq("job_id", id)
      .order("date", {
        ascending: false,
      }),

    /*
     * CAMBIOS DE ALCANCE
     */
    supabase
      .from("scope_changes")
      .select(`
        id,
        description,
        classification,
        created_at
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  /*
   * =====================================
   * RELACIONES DEL TRABAJO
   * =====================================
   */

  const projectName = relationValue(
    job.projects,
    "name"
  );

  const projectObject = Array.isArray(
    job.projects
  )
    ? job.projects[0]
    : job.projects;

  const clientRelation =
    projectObject &&
    typeof projectObject === "object"
      ? (
          projectObject as Record<
            string,
            unknown
          >
        ).clients
      : null;

  const clientName = relationValue(
    clientRelation,
    "name"
  );

  const responsibleName = relationValue(
    job.profiles,
    "full_name"
  );

  const categoryName = relationValue(
    job.job_categories,
    "name"
  );

  /*
   * =====================================
   * DATOS PROCESADOS
   * =====================================
   */

  const pendingItems =
    pendingResult.data ?? [];

  const nextStep =
    pendingItems.find(
      (item) =>
        item.status === "PENDING" &&
        item.is_next_step
    ) ?? null;

  const productions =
    productionsResult.data ?? [];

  const deliverableGroups =
    deliverableGroupsResult.data ?? [];

  const deliverables =
    deliverablesResult.data ?? [];

  const minutes =
    minutesResult.data ?? [];

  const scopeChanges =
    scopeChangesResult.data ?? [];

  /*
   * =====================================
   * INTERFAZ
   * =====================================
   */

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1300px] px-5 py-8 md:px-8">

        {/* VOLVER */}

        <Link
          href="/trabajos"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Trabajos
        </Link>

        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <BriefcaseBusiness size={23} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">

                <h1 className="text-2xl font-semibold tracking-tight">
                  {job.name}
                </h1>

                <JobStatusBadge
                  status={job.status}
                />

              </div>

              <p className="text-sm text-zinc-500">
                {clientName ??
                  "Sin cliente"}{" "}
                ·{" "}
                {projectName ??
                  "Sin proyecto"}
              </p>
            </div>

          </div>

          <div className="flex flex-wrap gap-3">
            <ActivityLink kind="trabajo" id={job.id} />

            <Link
              href={`/trabajos/${job.id}/editar`}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <Pencil size={16} />
              Editar Trabajo
            </Link>
          </div>
        </div>

        {/* RESUMEN SUPERIOR */}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            label="Cliente"
            value={
              clientName ??
              "Sin cliente"
            }
          />

          <SummaryCard
            label="Proyecto"
            value={
              projectName ??
              "Sin proyecto"
            }
          />

          <SummaryCard
            label="Categoría"
            value={
              categoryName ??
              "Sin categoría"
            }
          />

          <SummaryCard
            label="Responsable"
            value={
              responsibleName ??
              "Sin responsable"
            }
          />

        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">

          <SummaryCard
            label="Estado"
            value={formatJobStatus(
              job.status
            )}
          />

          <SummaryCard
            label="Deadline"
            value={
              job.general_deadline
                ? formatDate(
                    job.general_deadline
                  )
                : "Sin deadline"
            }
            icon={
              <CalendarDays
                size={16}
              />
            }
          />

          <SummaryCard
            label="Próximo paso"
            value={
              nextStep?.description ??
              "Sin próximo paso"
            }
            icon={
              <ListChecks
                size={16}
              />
            }
          />

        </section>

        {/* RESUMEN + BRIEF */}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

            <SectionHeader
              icon={
                <ClipboardList
                  size={18}
                />
              }
              title="Resumen"
              description="Información operativa principal del Trabajo."
            />

            <div className="divide-y divide-white/5">

              <InfoRow
                label="Nombre"
                value={job.name}
              />

              <InfoRow
                label="Cliente"
                value={
                  clientName ??
                  "Sin cliente"
                }
              />

              <InfoRow
                label="Proyecto"
                value={
                  projectName ??
                  "Sin proyecto"
                }
              />

              <InfoRow
                label="Categoría"
                value={
                  categoryName ??
                  "Sin categoría"
                }
              />

              <InfoRow
                label="Responsable"
                value={
                  responsibleName ??
                  "Sin responsable"
                }
              />

              <InfoRow
                label="Creado"
                value={formatDate(
                  job.created_at
                )}
              />

            </div>

          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

            <SectionHeader
              icon={
                <FileText
                  size={18}
                />
              }
              title="Brief"
              description="Brief original del Trabajo."
            />

            <div className="p-6">
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {job.original_brief ||
                  "Sin brief."}
              </p>
            </div>

          </section>

        </div>

        {/* =====================================
            ENTREGABLES
        ===================================== */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="text-[#45B8E8]">
                <FolderKanban
                  size={18}
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  Entregables
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Compromisos y piezas finales de este Trabajo.
                </p>
              </div>

            </div>

            <Link
              href={`/trabajos/${job.id}/entregables/nuevo`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/20"
            >
              <Plus size={15} />
              Nuevo entregable
            </Link>

          </div>

          {deliverableGroups.length === 0 ? (

            <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">

              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                <Layers3
                  size={19}
                />
              </div>

              <p className="text-sm font-medium text-zinc-300">
                Todavía no hay Entregables
              </p>

              <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
                Definí qué piezas debe entregar este Trabajo.
              </p>

              <Link
                href={`/trabajos/${job.id}/entregables/nuevo`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#20A4DD] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
              >
                <Plus size={16} />
                Crear Entregable
              </Link>

            </div>

          ) : (

            <div className="space-y-5 p-5">

              {deliverableGroups.map(
                (group: any) => {

                  const groupType =
                    relationValue(
                      group.deliverable_types,
                      "name"
                    );

                  const groupPieces =
                    deliverables.filter(
                      (piece: any) =>
                        piece.group_id ===
                        group.id
                    );

                  const properties =
                    getProperties(
                      group.common_properties
                    );

                  const completedPieces =
                    groupPieces.filter(
                      (piece: any) =>
                        piece.status ===
                          "DELIVERED" ||
                        piece.status ===
                          "APPROVED"
                    ).length;

                  return (
                    <div
                      key={group.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-[#07090B]"
                    >

                      {/* GRUPO */}

                      <div className="border-b border-white/10 p-5">

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-3">

                              <h3 className="text-base font-semibold text-zinc-100">
                                {group.name}
                              </h3>

                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
                                {groupType ??
                                  "Sin tipo"}
                              </span>

                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">

                              <span>
                                {groupPieces.length}{" "}
                                {groupPieces.length ===
                                1
                                  ? "pieza"
                                  : "piezas"}
                              </span>

                              {properties.format && (
                                <span>
                                  {
                                    properties.format
                                  }
                                </span>
                              )}

                              {properties.duration && (
                                <span>
                                  {
                                    properties.duration
                                  }
                                </span>
                              )}

                              {properties.resolution && (
                                <span>
                                  {
                                    properties.resolution
                                  }
                                </span>
                              )}

                            </div>

                          </div>

                          <div className="flex flex-wrap items-center gap-3">

                            {group.group_deadline ? (
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <CalendarDays
                                  size={14}
                                />

                                {formatDate(
                                  group.group_deadline
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-700">
                                Sin deadline
                              </span>
                            )}

                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-500">
                              {completedPieces}/
                              {groupPieces.length}
                            </span>

                          </div>

                        </div>

                        {group.notes && (
                          <p className="mt-4 border-t border-white/5 pt-4 text-xs leading-5 text-zinc-600">
                            {group.notes}
                          </p>
                        )}

                      </div>

                      {/* PIEZAS */}

                      {groupPieces.length ===
                      0 ? (

                        <div className="px-5 py-6 text-sm text-zinc-600">
                          Este grupo no tiene piezas.
                        </div>

                      ) : (

                        <div className="divide-y divide-white/5">

                          {groupPieces.map(
                            (piece: any) => {

                              const pieceType =
                                relationValue(
                                  piece.deliverable_types,
                                  "name"
                                );

                              const pieceResponsible =
                                relationValue(
                                  piece.profiles,
                                  "full_name"
                                );

                              const pieceProperties =
                                getProperties(
                                  piece.properties
                                );

                              return (
                                <div
                                  key={
                                    piece.id
                                  }
                                  className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.02] lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr]"
                                >

                                  {/* NOMBRE */}

                                  <div>

                                    <div className="flex items-center gap-2">

                                     <Link
  href={`/trabajos/${job.id}/entregables/${piece.id}`}
  className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
>
  {piece.name}
</Link>

                                      {piece.urgent && (
                                        <span className="rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
                                          Urgente
                                        </span>
                                      )}

                                    </div>

                                    <p className="mt-1 text-xs text-zinc-600">
                                      {pieceType ??
                                        groupType ??
                                        "Sin tipo"}
                                    </p>

                                  </div>

                                  {/* ESTADO */}

                                  <div>

                                    <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-700">
                                      Estado
                                    </p>

                                    <DeliverableStatusBadge
                                      status={
                                        piece.status
                                      }
                                    />

                                  </div>

                                  {/* RESPONSABLE */}

                                  <div>

                                    <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-700">
                                      Responsable
                                    </p>

                                    <p className="text-xs text-zinc-500">
                                      {pieceResponsible ??
                                        "Sin responsable"}
                                    </p>

                                  </div>

                                  {/* DEADLINE */}

                                  <div>

                                    <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-700">
                                      Deadline
                                    </p>

                                    <p className="text-xs text-zinc-500">
                                      {piece.deadline
                                        ? formatDate(
                                            piece.deadline
                                          )
                                        : "Sin deadline"}
                                    </p>

                                  </div>

                                  {/* PROPIEDADES */}

                                  {(pieceProperties.format ||
                                    pieceProperties.duration ||
                                    pieceProperties.resolution) && (

                                    <div className="lg:col-span-4">

                                      <div className="flex flex-wrap gap-2">

                                        {pieceProperties.format && (
                                          <PropertyBadge
                                            value={
                                              pieceProperties.format
                                            }
                                          />
                                        )}

                                        {pieceProperties.duration && (
                                          <PropertyBadge
                                            value={
                                              pieceProperties.duration
                                            }
                                          />
                                        )}

                                        {pieceProperties.resolution && (
                                          <PropertyBadge
                                            value={
                                              pieceProperties.resolution
                                            }
                                          />
                                        )}

                                      </div>

                                    </div>

                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* PRODUCCIONES */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            icon={
              <UsersRound
                size={18}
              />
            }
            title="Producciones"
            description="Jornadas de producción vinculadas a este Trabajo."
          />

          {productions.length ===
          0 ? (

            <EmptyState text="Todavía no hay Producciones vinculadas." />

          ) : (

            <div className="divide-y divide-white/5">

              {productions.map(
                (
                  item: any,
                  index: number
                ) => {

                  const productionName =
                    relationValue(
                      item.productions,
                      "name"
                    );

                  const productionStatus =
                    relationValue(
                      item.productions,
                      "status"
                    );

                  return (
                    <div
                      key={`${item.production_id}-${index}`}
                      className="grid gap-3 px-6 py-4 md:grid-cols-[1.5fr_1fr]"
                    >

                      <p className="text-sm font-medium text-zinc-200">
                        {productionName ??
                          "Producción"}
                      </p>

                      <p className="text-sm text-zinc-500">
                        {productionStatus
                          ? formatProductionStatus(
                              productionStatus
                            )
                          : "Sin estado"}
                      </p>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* PENDIENTES */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            icon={
              <ListChecks
                size={18}
              />
            }
            title="Pendientes"
            description="Acciones y puntos abiertos relacionados con este Trabajo."
          />

          {pendingItems.length ===
          0 ? (

            <EmptyState text="No hay Pendientes registrados." />

          ) : (

            <div className="divide-y divide-white/5">

              {pendingItems.map(
                (item) => (
                  <div
                    key={item.id}
                    className="grid gap-4 px-6 py-4 md:grid-cols-[1.7fr_1fr_1fr]"
                  >

                    <div>

                      <p className="text-sm text-zinc-300">
                        {item.description}
                      </p>

                      {item.is_next_step && (
                        <span className="mt-2 inline-flex rounded-full border border-[#20A4DD]/20 bg-[#20A4DD]/10 px-2 py-0.5 text-[11px] text-[#45B8E8]">
                          Próximo paso
                        </span>
                      )}

                    </div>

                    <p className="text-sm text-zinc-500">
                      {item.status ===
                      "PENDING"
                        ? "Pendiente"
                        : "Resuelto"}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {item.due_at
                        ? formatDate(
                            item.due_at
                          )
                        : "Sin fecha"}
                    </p>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* MINUTAS */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            icon={
              <MessageSquareText
                size={18}
              />
            }
            title="Minutas"
            description="Reuniones y decisiones asociadas al Trabajo."
          />

          {minutes.length ===
          0 ? (

            <EmptyState text="Todavía no hay Minutas registradas." />

          ) : (

            <div className="divide-y divide-white/5">

              {minutes.map(
                (minute) => (
                  <div
                    key={minute.id}
                    className="grid gap-3 px-6 py-4 md:grid-cols-[1.5fr_1fr]"
                  >

                    <p className="text-sm font-medium text-zinc-300">
                      {minute.title}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {formatDate(
                        minute.date
                      )}
                    </p>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* ALCANCE */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            icon={
              <FileText
                size={18}
              />
            }
            title="Alcance"
            description="Cambios y ampliaciones del alcance original."
          />

          {scopeChanges.length ===
          0 ? (

            <EmptyState text="No hay cambios de alcance registrados." />

          ) : (

            <div className="divide-y divide-white/5">

              {scopeChanges.map(
                (change) => (
                  <div
                    key={change.id}
                    className="grid gap-3 px-6 py-4 md:grid-cols-[1.7fr_1fr]"
                  >

                    <p className="text-sm text-zinc-300">
                      {change.description}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {formatScopeClassification(
                        change.classification
                      )}
                    </p>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* HISTORIAL */}

        <section className="mt-6 rounded-xl border border-dashed border-white/10 p-6">

          <div className="flex items-start gap-4">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-600">
              <ClipboardList
                size={18}
              />
            </div>

            <div>

              <p className="text-sm font-medium text-zinc-300">
                Historial
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Más adelante vamos a mostrar acá los cambios relevantes
                de estado, responsables y acciones del Trabajo.
              </p>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

/*
 * =====================================
 * COMPONENTES
 * =====================================
 */

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">

      <div className="flex items-center gap-2 text-xs text-zinc-600">
        {icon}
        {label}
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-medium text-zinc-200">
        {value}
      </p>

    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">

      <div className="text-[#45B8E8]">
        {icon}
      </div>

      <div>

        <h2 className="text-sm font-semibold">
          {title}
        </h2>

        <p className="mt-1 text-xs text-zinc-600">
          {description}
        </p>

      </div>

    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-10 text-center text-sm text-zinc-600">
      {text}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 px-6 py-5 sm:grid-cols-[170px_1fr]">

      <p className="text-sm text-zinc-600">
        {label}
      </p>

      <p className="text-sm text-zinc-300">
        {value}
      </p>

    </div>
  );
}

function PropertyBadge({
  value,
}: {
  value: string;
}) {
  return (
    <span className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-600">
      {value}
    </span>
  );
}

/*
 * =====================================
 * RELACIONES
 * =====================================
 */

function relationValue(
  relation: unknown,
  property: string
): string | undefined {
  if (!relation) {
    return undefined;
  }

  if (Array.isArray(relation)) {
    const first =
      relation[0] as
        | Record<
            string,
            unknown
          >
        | undefined;

    const value =
      first?.[property];

    return typeof value ===
      "string"
      ? value
      : undefined;
  }

  if (
    typeof relation ===
    "object"
  ) {
    const value = (
      relation as Record<
        string,
        unknown
      >
    )[property];

    return typeof value ===
      "string"
      ? value
      : undefined;
  }

  return undefined;
}

/*
 * =====================================
 * JSON PROPERTIES
 * =====================================
 */

function getProperties(
  value: unknown
): {
  format?: string;
  duration?: string;
  resolution?: string;
} {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  return {
    format:
      typeof object.format ===
      "string"
        ? object.format
        : undefined,

    duration:
      typeof object.duration ===
      "string"
        ? object.duration
        : undefined,

    resolution:
      typeof object.resolution ===
      "string"
        ? object.resolution
        : undefined,
  };
}

/*
 * =====================================
 * BADGES
 * =====================================
 */

function JobStatusBadge({
  status,
}: {
  status: string;
}) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    PENDING_PLANNING: {
      label:
        "Pendiente planificación",

      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    IN_PLANNING: {
      label:
        "En planificación",

      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    PLANNED: {
      label:
        "Planificado",

      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    PAUSED: {
      label:
        "Pausado",

      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    CANCELLED: {
      label:
        "Cancelado",

      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    COMPLETED: {
      label:
        "Completado",

      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    ARCHIVED: {
      label:
        "Archivado",

      className:
        "border-zinc-800 bg-zinc-900 text-zinc-500",
    },
  };

  const current =
    config[status] ?? {
      label: status,

      className:
        "border-zinc-800 bg-zinc-900 text-zinc-500",
    };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${current.className}`}
    >
      {current.label}
    </span>
  );
}

function DeliverableStatusBadge({
  status,
}: {
  status: string;
}) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    DEFINED: {
      label:
        "Definido",

      className:
        "border-zinc-700 bg-zinc-900 text-zinc-400",
    },

    PENDING_MATERIAL: {
      label:
        "Pendiente material",

      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    READY_POST: {
      label:
        "Listo para post",

      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    EDITING: {
      label:
        "En edición",

      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    COORDINATOR_REVIEW: {
      label:
        "Revisión coordinador",

      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    INTERNAL_REVIEW: {
      label:
        "Revisión interna",

      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    CLIENT_REVIEW: {
      label:
        "Revisión cliente",

      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },

    CORRECTIONS: {
      label:
        "Correcciones",

      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    APPROVED: {
      label:
        "Aprobado",

      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    DELIVERED: {
      label:
        "Entregado",

      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    OUT_OF_SCOPE: {
      label:
        "Fuera de alcance",

      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    },
  };

  const current =
    config[status] ?? {
      label: status,

      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${current.className}`}
    >
      {current.label}
    </span>
  );
}

/*
 * =====================================
 * FORMATOS
 * =====================================
 */

function formatJobStatus(
  status: string
) {
  const labels: Record<
    string,
    string
  > = {
    PENDING_PLANNING:
      "Pendiente de planificación",

    IN_PLANNING:
      "En planificación",

    PLANNED:
      "Planificado",

    PAUSED:
      "Pausado",

    CANCELLED:
      "Cancelado",

    COMPLETED:
      "Completado",

    ARCHIVED:
      "Archivado",
  };

  return (
    labels[status] ??
    status
  );
}

function formatProductionStatus(
  status: string
) {
  const labels: Record<
    string,
    string
  > = {
    PENDING_PLANNING:
      "Pendiente de planificación",

    PENDING_DATE:
      "Pendiente de fecha",

    SCHEDULED:
      "Agendada",

    READY:
      "Lista para producir",

    COMPLETED:
      "Realizada",

    NOT_COMPLETED:
      "No realizada",

    CANCELLED:
      "Cancelada",

    RESCHEDULED:
      "Reprogramada",
  };

  return (
    labels[status] ??
    status
  );
}

function formatScopeClassification(
  classification: string
) {
  const labels: Record<
    string,
    string
  > = {
    ORIGINAL_SCOPE:
      "Incluido en alcance original",

    COMMERCIAL_VALIDATION:
      "Requiere validación comercial",

    APPROVED_EXTRA:
      "Adicional aprobado",

    REJECTED:
      "No aprobado / descartado",
  };

  return (
    labels[
      classification
    ] ??
    classification
  );
}

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
}