import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ProductionManagementLink from "./production-management-link";
import NasDownloadSummary from "./nas-download-summary";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircleUserRound,
  ClipboardCheck,
  Film,
  HardDrive,
  Link2,
  MapPin,
  Pencil,
  Settings2,
  Users,
  Video,
} from "lucide-react";

import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductionDetailPage({
  params,
}: PageProps) {
  const {
    id: productionId,
  } = await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * PRODUCCIÓN
   * =====================================
   */

  const {
    data: production,
    error: productionError,
  } = await supabase
    .from("productions")
    .select(`
      id,
      name,
      description,
      responsible_user_id,
      status,
      start_at,
      end_at,
      location,
      preparation_review_at,
      notes,
      created_at,
      updated_at,

      responsible:responsible_user_id (
        id,
        full_name
      )
    `)
    .eq(
      "id",
      productionId
    )
    .single();

  if (
    productionError ||
    !production
  ) {
    notFound();
  }

  /*
   * =====================================
   * DATOS RELACIONADOS
   * =====================================
   */

  const [
    jobsResult,
    participantsResult,
    externalParticipantsResult,
    equipmentResult,
    checklistResult,
  ] = await Promise.all([
    supabase
      .from("production_jobs")
      .select(`
        production_id,
        job_id,

        jobs:job_id (
          id,
          name,
          status,

          projects:project_id (
            id,
            name,

            clients:client_id (
              id,
              name
            )
          )
        )
      `)
      .eq(
        "production_id",
        productionId
      ),

    supabase
      .from("production_participants")
      .select(`
        id,
        production_id,
        user_id,
        role_id,
        role_detail,
        attendance_status,
        attendance_reason,
        created_at,

        profile:user_id (
          id,
          full_name
        ),

        role:role_id (
          id,
          name
        )
      `)
      .eq(
        "production_id",
        productionId
      ),

    supabase
      .from("production_external_participants")
      .select(`
        id,
        production_id,
        external_participant_id,
        role_id,
        role_detail,
        attendance_status,
        attendance_reason,
        created_at,

        external_participants:external_participant_id (
          id,
          full_name,
          email,
          company
        ),

        role:role_id (
          id,
          name
        )
      `)
      .eq(
        "production_id",
        productionId
      ),

    supabase
      .from("production_equipment")
      .select(`
        id,
        production_id,
        item_name,
        used_by_user_id,
        prepared_by_user_id,
        notes,
        created_at,

        used_by:used_by_user_id (
          id,
          full_name
        ),

        prepared_by:prepared_by_user_id (
          id,
          full_name
        )
      `)
      .eq(
        "production_id",
        productionId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      ),

    supabase
      .from("production_checklist_items")
      .select(`
        id,
        production_id,
        label,
        status,
        responsible_user_id,
        comment,
        created_at,
        resolved_at,

        responsible:responsible_user_id (
          id,
          full_name
        )
      `)
      .eq(
        "production_id",
        productionId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      ),

  ]);

  /*
   * =====================================
   * NORMALIZAR
   * =====================================
   */

  const jobs =
    jobsResult.data ?? [];

  const participants =
    participantsResult.data ?? [];

  const externalParticipants =
    externalParticipantsResult.data ??
    [];

  const equipment =
    equipmentResult.data ?? [];

  const checklist =
    checklistResult.data ?? [];

  const relatedError =
    jobsResult.error ||
    participantsResult.error ||
    externalParticipantsResult.error ||
    equipmentResult.error ||
    checklistResult.error;

  /*
   * =====================================
   * MÉTRICAS
   * =====================================
   */

  const checklistResolved =
    checklist.filter(
      (item) =>
        isCompletedStatus(
          item.status
        )
    ).length;

  const totalParticipants =
    participants.length +
    externalParticipants.length;

  const preparationOverdue =
    Boolean(
      production.preparation_review_at
    ) &&
    new Date(
      production.preparation_review_at
    ) < new Date() &&
    ![
      "READY",
      "COMPLETED",
      "CANCELLED",
      "NOT_COMPLETED",
    ].includes(
      production.status
    );

  const responsibleName =
    relationValue(
      production.responsible,
      "full_name"
    ) ?? "Sin responsable";

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8">

          <Link
            href="/producciones"
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />

            Volver a Producciones
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
                <Video
                  size={21}
                />
              </div>

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-2xl font-semibold tracking-tight">
                    {production.name}
                  </h1>

                  <ProductionStatusBadge
                    status={
                      production.status
                    }
                  />

                </div>

                {production.description && (
                  <p className="mt-2 max-w-[800px] text-sm leading-relaxed text-zinc-500">
                    {
                      production.description
                    }
                  </p>
                )}

              </div>

            </div>

            <Link
              href={`/producciones/${production.id}/editar`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-4 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Pencil
                size={15}
              />

              Editar producción
            </Link>

            <Link
              href={`/producciones/${production.id}/carpeta-nas`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-4 text-sm text-[#45B8E8] transition hover:bg-[#20A4DD]/20"
            >
              <HardDrive size={15} />
              Preparar carpeta en NAS
            </Link>

          </div>

        </div>

        <NasDownloadSummary productionId={productionId} />

        {/* =====================================
            MÉTRICAS
        ===================================== */}

        <section className="grid gap-4 sm:grid-cols-3">

          <MetricCard
            label="Trabajos"
            value={
              jobs.length
            }
            icon={
              <Film
                size={17}
              />
            }
          />

          <MetricCard
            label="Participantes"
            value={
              totalParticipants
            }
            icon={
              <Users
                size={17}
              />
            }
          />

          <MetricCard
            label="Checklist"
            value={`${checklistResolved}/${checklist.length}`}
            icon={
              <ClipboardCheck
                size={17}
              />
            }
          />

        </section>

        {relatedError && (
          <div className="mt-6 rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            Parte de la información relacionada no pudo cargarse.
          </div>
        )}

        {/* =====================================
            INFORMACIÓN
        ===================================== */}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <SectionHeader
              title="Información general"
              subtitle="Datos principales de la jornada."
              icon={
                <Video
                  size={17}
                />
              }
            />

            <div className="grid gap-5 p-6 sm:grid-cols-2">

              <InfoItem
                label="Responsable"
                value={
                  responsibleName
                }
              />

              <InfoItem
                label="Estado"
                value={
                  getProductionStatusLabel(
                    production.status
                  )
                }
              />

              <InfoItem
                label="Inicio"
                value={
                  production.start_at
                    ? formatDateTime(
                        production.start_at
                      )
                    : "Fecha pendiente"
                }
              />

              <InfoItem
                label="Fin estimado"
                value={
                  production.end_at
                    ? formatDateTime(
                        production.end_at
                      )
                    : "Sin definir"
                }
              />

              <div className="sm:col-span-2">

                <InfoItem
                  label="Lugar"
                  value={
                    production.location ??
                    "Sin lugar definido"
                  }
                  icon={
                    production.location
                      ? (
                        <MapPin
                          size={13}
                        />
                      )
                      : undefined
                  }
                />

              </div>

            </div>

          </section>

          <section
            className={`rounded-xl border ${
              preparationOverdue
                ? "border-red-900/30 bg-red-950/10"
                : "border-white/10 bg-[#0B0F12]"
            }`}
          >

            <SectionHeader
              title="Preparación"
              subtitle="Control previo al rodaje."
              icon={
                preparationOverdue
                  ? (
                    <AlertTriangle
                      size={17}
                      className="text-red-400"
                    />
                  )
                  : (
                    <CalendarClock
                      size={17}
                    />
                  )
              }
            />

            <div className="p-6">

              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
                Revisión programada
              </p>

              <p
                className={`mt-2 text-sm ${
                  preparationOverdue
                    ? "text-red-400"
                    : "text-zinc-300"
                }`}
              >
                {production.preparation_review_at
                  ? formatDateTime(
                      production.preparation_review_at
                    )
                  : "Sin revisión programada"}
              </p>

              {preparationOverdue && (
                <div className="mt-4 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                  La revisión de preparación está vencida.
                </div>
              )}

              <div className="mt-5">

                <ProgressRow
                  label="Checklist"
                  completed={
                    checklistResolved
                  }
                  total={
                    checklist.length
                  }
                />

              </div>

            </div>

          </section>

        </div>

        {/* =====================================
            TRABAJOS
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Trabajos vinculados"
            subtitle="Trabajos que forman parte de esta producción."
            icon={
              <Film
                size={17}
              />
            }
            count={
              jobs.length
            }
            action={
              <Link
                href={`/producciones/${productionId}/trabajos`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/15"
              >
                <Link2
                  size={14}
                />

                Vincular trabajos
              </Link>
            }
          />

          {jobs.length === 0 ? (

            <EmptyState
              text="Todavía no hay trabajos vinculados."
            />

          ) : (

            <div className="divide-y divide-white/5">

              {jobs.map(
                (row: any) => {

                  const job =
                    firstRelation(
                      row.jobs
                    );

                  const project =
                    firstRelation(
                      job?.projects
                    );

                  const client =
                    firstRelation(
                      project?.clients
                    );

                  return (
                    <div
                      key={
                        row.job_id
                      }
                      className="flex flex-col gap-4 px-6 py-5 transition hover:bg-white/[0.02] md:flex-row md:items-center md:justify-between"
                    >

                      <div>

                        <Link
                          href={`/trabajos/${row.job_id}`}
                          className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                        >
                          {job?.name ??
                            "Trabajo"}
                        </Link>

                        <p className="mt-1 text-xs text-zinc-700">
                          {client?.name ??
                            "Sin cliente"}
                          {" · "}
                          {project?.name ??
                            "Sin proyecto"}
                        </p>

                      </div>

                      <Link
                        href={`/trabajos/${row.job_id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 px-3 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                      >
                        Ver trabajo
                      </Link>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* =====================================
            EQUIPO HUMANO
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Equipo humano"
            subtitle="Participantes internos y externos."
            icon={
              <Users
                size={17}
              />
            }
            count={
              totalParticipants
            }
            action={
              <Link
                href={`/producciones/${productionId}/equipo`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/15"
              >
                <Settings2
                  size={14}
                />

                Gestionar equipo
              </Link>
            }
          />

          {totalParticipants ===
          0 ? (

            <EmptyState
              text="Todavía no hay participantes cargados."
            />

          ) : (

            <div className="grid gap-5 p-5 xl:grid-cols-2">

              {/* INTERNOS */}

              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#07090B]">

                <div className="border-b border-white/[0.07] px-4 py-3">
                  <p className="text-xs font-medium text-zinc-400">
                    Equipo AeroPro
                  </p>
                </div>

                {participants.length ===
                0 ? (
                  <div className="p-4 text-xs text-zinc-700">
                    Sin participantes internos.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">

                    {participants.map(
                      (
                        participant: any
                      ) => {

                        const name =
                          relationValue(
                            participant.profile,
                            "full_name"
                          ) ??
                          "Usuario";

                        const role =
                          firstRelation(
                            participant.role
                          );

                        const roleLabel =
                          getRoleLabel(
                            role?.name,
                            participant.role_detail
                          );

                        return (
                          <div
                            key={
                              participant.id
                            }
                            className="flex items-center justify-between gap-4 px-4 py-4"
                          >

                            <div className="flex min-w-0 items-center gap-3">

                              <CircleUserRound
                                size={17}
                                className="shrink-0 text-zinc-600"
                              />

                              <div className="min-w-0">

                                <p className="truncate text-xs font-medium text-zinc-300">
                                  {name}
                                </p>

                                <p className="mt-1 truncate text-[10px] text-[#45B8E8]">
                                  {roleLabel}
                                </p>

                              </div>

                            </div>

                            <AttendanceBadge
                              value={
                                participant.attendance_status
                              }
                            />

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              {/* EXTERNOS */}

              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#07090B]">

                <div className="border-b border-white/[0.07] px-4 py-3">
                  <p className="text-xs font-medium text-zinc-400">
                    Externos
                  </p>
                </div>

                {externalParticipants.length ===
                0 ? (
                  <div className="p-4 text-xs text-zinc-700">
                    Sin participantes externos.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">

                    {externalParticipants.map(
                      (
                        participant: any
                      ) => {

                        const external =
                          firstRelation(
                            participant.external_participants
                          );

                        const role =
                          firstRelation(
                            participant.role
                          );

                        const roleLabel =
                          getRoleLabel(
                            role?.name,
                            participant.role_detail
                          );

                        return (
                          <div
                            key={
                              participant.id
                            }
                            className="flex items-center justify-between gap-4 px-4 py-4"
                          >

                            <div className="min-w-0">

                              <p className="truncate text-xs font-medium text-zinc-300">
                                {external?.full_name ??
                                  "Participante externo"}
                              </p>

                              <p className="mt-1 truncate text-[10px] text-[#45B8E8]">
                                {roleLabel}
                              </p>

                              {external?.company && (
                                <p className="mt-1 truncate text-[10px] text-zinc-700">
                                  {
                                    external.company
                                  }
                                </p>
                              )}

                            </div>

                            <AttendanceBadge
                              value={
                                participant.attendance_status
                              }
                            />

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

            </div>

          )}

        </section>

        {/* =====================================
            EQUIPAMIENTO
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Equipamiento"
            subtitle="Equipo técnico previsto para la producción."
            icon={
              <Camera
                size={17}
              />
            }
            count={
              equipment.length
            }
            action={
  <ProductionManagementLink
    href={`/producciones/${productionId}/equipamiento`}
    type="equipment"
  />
}
          />

          {equipment.length ===
          0 ? (

            <EmptyState
              text="Todavía no hay equipamiento cargado."
            />

          ) : (

            <div className="divide-y divide-white/5">

              {equipment.map(
                (
                  item: any
                ) => {

                  const usedBy =
                    relationValue(
                      item.used_by,
                      "full_name"
                    );

                  const preparedBy =
                    relationValue(
                      item.prepared_by,
                      "full_name"
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="grid gap-4 px-6 py-4 md:grid-cols-[1fr_0.8fr_0.8fr]"
                    >

                      <div>

                        <p className="text-sm text-zinc-300">
                          {
                            item.item_name
                          }
                        </p>

                        {item.notes && (
                          <p className="mt-1 text-xs text-zinc-700">
                            {
                              item.notes
                            }
                          </p>
                        )}

                      </div>

                      <InfoSmall
                        label="Usa"
                        value={
                          usedBy ??
                          "Sin definir"
                        }
                      />

                      <InfoSmall
                        label="Prepara"
                        value={
                          preparedBy ??
                          "Sin definir"
                        }
                      />

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* =====================================
            CHECKLIST
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
  title="Checklist"
  subtitle="Pendientes necesarios antes de salir a producir."
  icon={
    <ClipboardCheck
      size={17}
    />
  }
  count={
    checklist.length
  }
  action={
    <ProductionManagementLink
      href={`/producciones/${productionId}/checklist`}
      type="checklist"
    />
  }
/>
          ) : (

            <div className="divide-y divide-white/5">

              {checklist.map(
                (
                  item: any
                ) => {

                  const resolved =
                    isCompletedStatus(
                      item.status
                    );

                  const responsible =
                    relationValue(
                      item.responsible,
                      "full_name"
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-start gap-4 px-6 py-4"
                    >

                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          resolved
                            ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-400"
                            : "border-white/10 text-zinc-700"
                        }`}
                      >
                        {resolved && (
                          <CheckCircle2
                            size={13}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">

                        <p
                          className={`text-sm ${
                            resolved
                              ? "text-zinc-500 line-through"
                              : "text-zinc-300"
                          }`}
                        >
                          {
                            item.label
                          }
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-700">

                          {responsible && (
                            <span>
                              Responsable:{" "}
                              {responsible}
                            </span>
                          )}

                          {item.comment && (
                            <span>
                              {
                                item.comment
                              }
                            </span>
                          )}

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )

        </section>

        {/* =====================================
            NOTAS
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Notas"
            subtitle="Información interna de la producción."
            icon={
              <ClipboardCheck
                size={17}
              />
            }
          />

          <div className="p-6">

            {production.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {
                  production.notes
                }
              </p>
            ) : (
              <p className="text-sm text-zinc-700">
                Sin notas cargadas.
              </p>
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

/*
 * =====================================
 * SECTION HEADER
 * =====================================
 */

function SectionHeader({
  title,
  subtitle,
  icon,
  count,
  action,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-3">

        <div className="text-[#45B8E8]">
          {icon}
        </div>

        <div>

          <h2 className="text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-xs text-zinc-600">
            {subtitle}
          </p>

        </div>

      </div>

      <div className="flex items-center gap-3">

        {typeof count ===
          "number" && (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
            {count}
          </span>
        )}

        {action}

      </div>

    </div>
  );
}

/*
 * =====================================
 * ATTENDANCE
 * =====================================
 */

function AttendanceBadge({
  value,
}: {
  value?: string | null;
}) {
  const config =
    getAttendanceConfig(
      value
    );

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function getAttendanceConfig(
  value?: string | null
) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    PENDING: {
      label: "Pendiente",
      className:
        "border-amber-900/40 bg-amber-950/20 text-amber-400",
    },

    CONFIRMED: {
      label: "Confirmado",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    PRESENT: {
      label: "Presente",
      className:
        "border-emerald-900/40 bg-emerald-950/20 text-emerald-400",
    },

    ABSENT: {
      label: "Ausente",
      className:
        "border-red-900/40 bg-red-950/20 text-red-400",
    },

    CANCELLED: {
      label: "Cancelado",
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    },
  };

  return (
    config[value ?? ""] ?? {
      label:
        value ??
        "Sin estado",
      className:
        "border-white/10 bg-white/[0.03] text-zinc-500",
    }
  );
}

/*
 * =====================================
 * INFO
 * =====================================
 */

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>

      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">

        {icon && (
          <span className="text-zinc-600">
            {icon}
          </span>
        )}

        {value}

      </div>

    </div>
  );
}

function InfoSmall({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </p>

      <p className="mt-1 text-xs text-zinc-400">
        {value}
      </p>

    </div>
  );
}

/*
 * =====================================
 * PROGRESS
 * =====================================
 */

function ProgressRow({
  label,
  completed,
  total,
}: {
  label: string;
  completed: number;
  total: number;
}) {
  const percent =
    total > 0
      ? Math.round(
          (completed /
            total) *
            100
        )
      : 0;

  return (
    <div>

      <div className="flex items-center justify-between">

        <span className="text-xs text-zinc-500">
          {label}
        </span>

        <span className="text-xs text-zinc-600">
          {completed}/{total}
        </span>

      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">

        <div
          className="h-full rounded-full bg-[#20A4DD]"
          style={{
            width:
              `${percent}%`,
          }}
        />

      </div>

    </div>
  );
}

/*
 * =====================================
 * MÉTRICA
 * =====================================
 */

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">

      <div className="flex items-center gap-2 text-xs text-zinc-600">

        {icon}

        {label}

      </div>

      <p className="mt-3 text-2xl font-semibold text-zinc-100">
        {value}
      </p>

    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-10 text-center text-sm text-zinc-700">
      {text}
    </div>
  );
}

/*
 * =====================================
 * STATUS PRODUCCIÓN
 * =====================================
 */

function ProductionStatusBadge({
  status,
}: {
  status: string;
}) {
  const current =
    getProductionStatusConfig(
      status
    );

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] ${current.className}`}
    >
      {current.label}
    </span>
  );
}

function getProductionStatusLabel(
  status: string
) {
  return getProductionStatusConfig(
    status
  ).label;
}

function getProductionStatusConfig(
  status: string
) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    PENDING_PLANNING: {
      label:
        "Pendiente de planificación",
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-400",
    },

    PENDING_DATE: {
      label:
        "Pendiente de fecha",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    SCHEDULED: {
      label:
        "Programada",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    READY: {
      label:
        "Lista para producir",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    COMPLETED: {
      label:
        "Completada",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    NOT_COMPLETED: {
      label:
        "No realizada",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    CANCELLED: {
      label:
        "Cancelada",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    RESCHEDULED: {
      label:
        "Reprogramada",
      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },
  };

  return (
    config[status] ?? {
      label:
        status,
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    }
  );
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

function normalizeRoleName(
  value?: string | null
) {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}

function getRoleLabel(
  roleName?: string,
  roleDetail?: string | null
) {
  if (!roleName) {
    return "Sin rol";
  }

  if (
    normalizeRoleName(
      roleName
    ) === "otro"
  ) {
    return roleDetail
      ? `Otro · ${roleDetail}`
      : "Otro";
  }

  return roleName;
}

function firstRelation(
  relation: any
) {
  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return (
    relation ??
    null
  );
}

function relationValue(
  relation: unknown,
  property: string
): string | undefined {
  if (!relation) {
    return undefined;
  }

  if (
    Array.isArray(
      relation
    )
  ) {
    const first =
      relation[0] as
        | Record<
            string,
            unknown
          >
        | undefined;

    const value =
      first?.[
        property
      ];

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

function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function isCompletedStatus(
  status: string
) {
  return [
    "COMPLETED",
    "DONE",
    "RESOLVED",
  ].includes(
    status
  );
}
