import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  Users,
  Video,
} from "lucide-react";

type ProductionItem = any;

export default async function ProductionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * PRODUCCIONES
   * =====================================
   */

  const {
    data: productions,
    error,
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
    .order("start_at", {
      ascending: true,
      nullsFirst: false,
    });

  const allProductions =
    (productions ?? []) as ProductionItem[];

  /*
   * =====================================
   * RELACIONES AUXILIARES
   * =====================================
   */

  const productionIds =
    allProductions.map(
      (production) =>
        production.id
    );

  let jobsByProduction =
    new Map<string, number>();

  let participantsByProduction =
    new Map<string, number>();

  let checklistByProduction =
    new Map<
      string,
      {
        total: number;
        resolved: number;
      }
    >();

  let downloadsByProduction =
    new Map<
      string,
      {
        total: number;
        completed: number;
      }
    >();

  let backupsByProduction =
    new Map<
      string,
      {
        total: number;
        completed: number;
      }
    >();

  if (
    productionIds.length >
    0
  ) {
    const [
      productionJobsResult,
      participantsResult,
      externalParticipantsResult,
      checklistResult,
      downloadsResult,
      backupsResult,
    ] = await Promise.all([
      supabase
        .from("production_jobs")
        .select(`
          production_id,
          job_id
        `)
        .in(
          "production_id",
          productionIds
        ),

      supabase
        .from("production_participants")
        .select(`
          production_id,
          id
        `)
        .in(
          "production_id",
          productionIds
        ),

      supabase
        .from("production_external_participants")
        .select(`
          production_id,
          id
        `)
        .in(
          "production_id",
          productionIds
        ),

      supabase
        .from("production_checklist_items")
        .select(`
          production_id,
          status
        `)
        .in(
          "production_id",
          productionIds
        ),

      supabase
        .from("material_downloads")
        .select(`
          production_id,
          status
        `)
        .in(
          "production_id",
          productionIds
        ),

      supabase
        .from("material_backups")
        .select(`
          production_id,
          status
        `)
        .in(
          "production_id",
          productionIds
        ),
    ]);

    /*
     * TRABAJOS
     */

    for (
      const row of
      productionJobsResult.data ??
      []
    ) {
      const current =
        jobsByProduction.get(
          row.production_id
        ) ?? 0;

      jobsByProduction.set(
        row.production_id,
        current + 1
      );
    }

    /*
     * PARTICIPANTES INTERNOS
     */

    for (
      const row of
      participantsResult.data ??
      []
    ) {
      const current =
        participantsByProduction.get(
          row.production_id
        ) ?? 0;

      participantsByProduction.set(
        row.production_id,
        current + 1
      );
    }

    /*
     * PARTICIPANTES EXTERNOS
     */

    for (
      const row of
      externalParticipantsResult.data ??
      []
    ) {
      const current =
        participantsByProduction.get(
          row.production_id
        ) ?? 0;

      participantsByProduction.set(
        row.production_id,
        current + 1
      );
    }

    /*
     * CHECKLIST
     */

    for (
      const row of
      checklistResult.data ??
      []
    ) {
      const current =
        checklistByProduction.get(
          row.production_id
        ) ?? {
          total: 0,
          resolved: 0,
        };

      current.total += 1;

      if (
        row.status ===
          "RESOLVED" ||
        row.status ===
          "DONE" ||
        row.status ===
          "COMPLETED"
      ) {
        current.resolved += 1;
      }

      checklistByProduction.set(
        row.production_id,
        current
      );
    }

    /*
     * DESCARGAS
     */

    for (
      const row of
      downloadsResult.data ??
      []
    ) {
      const current =
        downloadsByProduction.get(
          row.production_id
        ) ?? {
          total: 0,
          completed: 0,
        };

      current.total += 1;

      if (
        row.status ===
          "COMPLETED" ||
        row.status ===
          "DONE" ||
        row.status ===
          "DOWNLOADED"
      ) {
        current.completed += 1;
      }

      downloadsByProduction.set(
        row.production_id,
        current
      );
    }

    /*
     * BACKUPS
     */

    for (
      const row of
      backupsResult.data ??
      []
    ) {
      const current =
        backupsByProduction.get(
          row.production_id
        ) ?? {
          total: 0,
          completed: 0,
        };

      current.total += 1;

      if (
        row.status ===
          "COMPLETED" ||
        row.status ===
          "DONE"
      ) {
        current.completed += 1;
      }

      backupsByProduction.set(
        row.production_id,
        current
      );
    }
  }

  /*
   * =====================================
   * CLASIFICACIONES
   * =====================================
   */

  const pendingDate =
    allProductions.filter(
      (production) =>
        production.status ===
        "PENDING_DATE"
    );

  const planning =
    allProductions.filter(
      (production) =>
        production.status ===
          "PENDING_PLANNING" ||
        production.status ===
          "SCHEDULED"
    );

  const ready =
    allProductions.filter(
      (production) =>
        production.status ===
        "READY"
    );

  const upcoming =
    allProductions
      .filter(
        (production) =>
          production.start_at &&
          new Date(
            production.start_at
          ) >=
            new Date() &&
          ![
            "COMPLETED",
            "NOT_COMPLETED",
            "CANCELLED",
          ].includes(
            production.status
          )
      )
      .sort(
        (a, b) =>
          new Date(
            a.start_at
          ).getTime() -
          new Date(
            b.start_at
          ).getTime()
      );

  const recentCompleted =
    allProductions
      .filter(
        (production) =>
          production.status ===
          "COMPLETED"
      )
      .sort(
        (a, b) =>
          new Date(
            b.updated_at
          ).getTime() -
          new Date(
            a.updated_at
          ).getTime()
      )
      .slice(0, 8);

  const now =
    new Date();

  const overduePreparation =
    allProductions.filter(
      (production) =>
        production.preparation_review_at &&
        new Date(
          production.preparation_review_at
        ) <
          now &&
        ![
          "READY",
          "COMPLETED",
          "CANCELLED",
          "NOT_COMPLETED",
        ].includes(
          production.status
        )
    ).length;

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >
              <ArrowLeft
                size={16}
              />

              Volver al Dashboard
            </Link>

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
                <Video
                  size={21}
                />
              </div>

              <div>

                <h1 className="text-2xl font-semibold tracking-tight">
                  Producciones
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Rodajes, equipos, checklist y estado de material.
                </p>

              </div>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500">
              <Search
                size={17}
              />

              Buscar producción...
            </div>

            <Link
              href="/producciones/nueva"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus
                size={16}
              />

              Nueva producción
            </Link>

          </div>

        </div>

        {/* =====================================
            MÉTRICAS
        ===================================== */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <MetricCard
            label="Próximas"
            value={
              upcoming.length
            }
            icon={
              <CalendarClock
                size={17}
              />
            }
          />

          <MetricCard
            label="Pendientes de fecha"
            value={
              pendingDate.length
            }
            icon={
              <Clock3
                size={17}
              />
            }
          />

          <MetricCard
            label="En planificación"
            value={
              planning.length
            }
            icon={
              <Video
                size={17}
              />
            }
          />

          <MetricCard
            label="Listas"
            value={
              ready.length
            }
            icon={
              <CheckCircle2
                size={17}
              />
            }
          />

          <MetricCard
            label="Revisión vencida"
            value={
              overduePreparation
            }
            icon={
              <AlertTriangle
                size={17}
              />
            }
            danger={
              overduePreparation >
              0
            }
          />

        </section>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar las producciones.
          </div>
        )}

        {/* =====================================
            PRÓXIMAS PRODUCCIONES
        ===================================== */}

        <ProductionSection
          title="Próximas producciones"
          description="Rodajes con fecha programada."
          count={
            upcoming.length
          }
          icon={
            <CalendarClock
              size={18}
            />
          }
        >

          <ProductionList
            productions={
              upcoming
            }
            jobsByProduction={
              jobsByProduction
            }
            participantsByProduction={
              participantsByProduction
            }
            checklistByProduction={
              checklistByProduction
            }
            downloadsByProduction={
              downloadsByProduction
            }
            backupsByProduction={
              backupsByProduction
            }
          />

        </ProductionSection>

        {/* =====================================
            PENDIENTES DE FECHA
        ===================================== */}

        <ProductionSection
          title="Pendientes de fecha"
          description="Producciones confirmadas o abiertas que todavía necesitan fecha."
          count={
            pendingDate.length
          }
          icon={
            <Clock3
              size={18}
            />
          }
        >

          <ProductionList
            productions={
              pendingDate
            }
            jobsByProduction={
              jobsByProduction
            }
            participantsByProduction={
              participantsByProduction
            }
            checklistByProduction={
              checklistByProduction
            }
            downloadsByProduction={
              downloadsByProduction
            }
            backupsByProduction={
              backupsByProduction
            }
          />

        </ProductionSection>

        {/* =====================================
            LISTAS
        ===================================== */}

        <ProductionSection
          title="Listas para producir"
          description="Producciones que ya están preparadas para el rodaje."
          count={
            ready.length
          }
          icon={
            <CheckCircle2
              size={18}
            />
          }
        >

          <ProductionList
            productions={
              ready
            }
            jobsByProduction={
              jobsByProduction
            }
            participantsByProduction={
              participantsByProduction
            }
            checklistByProduction={
              checklistByProduction
            }
            downloadsByProduction={
              downloadsByProduction
            }
            backupsByProduction={
              backupsByProduction
            }
          />

        </ProductionSection>

        {/* =====================================
            COMPLETADAS RECIENTES
        ===================================== */}

        <ProductionSection
          title="Completadas recientemente"
          description="Últimas producciones finalizadas."
          count={
            recentCompleted.length
          }
          icon={
            <PackageCheck
              size={18}
            />
          }
          secondary
        >

          <ProductionList
            productions={
              recentCompleted
            }
            jobsByProduction={
              jobsByProduction
            }
            participantsByProduction={
              participantsByProduction
            }
            checklistByProduction={
              checklistByProduction
            }
            downloadsByProduction={
              downloadsByProduction
            }
            backupsByProduction={
              backupsByProduction
            }
          />

        </ProductionSection>

      </div>
    </main>
  );
}

/*
 * =====================================
 * LISTADO
 * =====================================
 */

function ProductionList({
  productions,
  jobsByProduction,
  participantsByProduction,
  checklistByProduction,
  downloadsByProduction,
  backupsByProduction,
}: {
  productions: ProductionItem[];

  jobsByProduction:
    Map<string, number>;

  participantsByProduction:
    Map<string, number>;

  checklistByProduction:
    Map<
      string,
      {
        total: number;
        resolved: number;
      }
    >;

  downloadsByProduction:
    Map<
      string,
      {
        total: number;
        completed: number;
      }
    >;

  backupsByProduction:
    Map<
      string,
      {
        total: number;
        completed: number;
      }
    >;
}) {
  if (
    productions.length ===
    0
  ) {
    return (
      <div className="px-6 py-12 text-center text-sm text-zinc-700">
        No hay producciones en esta sección.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">

      {productions.map(
        (production) => {

          const responsibleName =
            relationValue(
              production.responsible,
              "full_name"
            ) ??
            "Sin responsable";

          const jobsCount =
            jobsByProduction.get(
              production.id
            ) ?? 0;

          const participantsCount =
            participantsByProduction.get(
              production.id
            ) ?? 0;

          const checklist =
            checklistByProduction.get(
              production.id
            ) ?? {
              total: 0,
              resolved: 0,
            };

          const downloads =
            downloadsByProduction.get(
              production.id
            ) ?? {
              total: 0,
              completed: 0,
            };

          const backups =
            backupsByProduction.get(
              production.id
            ) ?? {
              total: 0,
              completed: 0,
            };

          return (
            <div
              key={
                production.id
              }
              className="grid gap-5 px-6 py-5 transition hover:bg-white/[0.02] xl:grid-cols-[1.25fr_0.9fr_0.8fr_0.9fr_110px]"
            >

              {/* PRODUCCIÓN */}

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <Link
                    href={`/producciones/${production.id}`}
                    className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                  >
                    {
                      production.name
                    }
                  </Link>

                  <ProductionStatusBadge
                    status={
                      production.status
                    }
                  />

                </div>

                {production.description && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                    {
                      production.description
                    }
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-700">

                  <span className="flex items-center gap-1.5">
                    <CircleUserRoundIcon />
                    {
                      responsibleName
                    }
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Users
                      size={12}
                    />

                    {
                      participantsCount
                    } participantes
                  </span>

                  <span>
                    {
                      jobsCount
                    }{" "}
                    {jobsCount === 1
                      ? "trabajo"
                      : "trabajos"}
                  </span>

                </div>

              </div>

              {/* FECHA / LUGAR */}

              <div>

                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
                  Fecha y lugar
                </p>

                <p className="mt-2 text-xs text-zinc-400">
                  {production.start_at
                    ? formatDateTime(
                        production.start_at
                      )
                    : "Fecha pendiente"}
                </p>

                {production.location && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-600">
                    <MapPin
                      size={12}
                      className="mt-0.5 shrink-0"
                    />

                    {
                      production.location
                    }
                  </p>
                )}

              </div>

              {/* PREPARACIÓN */}

              <div>

                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
                  Preparación
                </p>

                <p className="mt-2 text-xs text-zinc-400">
                  Checklist{" "}
                  {
                    checklist.resolved
                  }
                  /
                  {
                    checklist.total
                  }
                </p>

                {production.preparation_review_at && (
                  <p
                    className={`mt-2 text-[11px] ${
                      isPreparationOverdue(
                        production
                      )
                        ? "text-red-400"
                        : "text-zinc-700"
                    }`}
                  >
                    Revisar{" "}
                    {formatDateTime(
                      production.preparation_review_at
                    )}
                  </p>
                )}

              </div>

              {/* MATERIAL */}

              <div>

                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
                  Material
                </p>

                <p className="mt-2 text-xs text-zinc-400">
                  Descargas{" "}
                  {
                    downloads.completed
                  }
                  /
                  {
                    downloads.total
                  }
                </p>

                <p className="mt-2 text-xs text-zinc-400">
                  Backups{" "}
                  {
                    backups.completed
                  }
                  /
                  {
                    backups.total
                  }
                </p>

              </div>

              {/* ACCIÓN */}

              <div className="flex items-center xl:justify-end">

                <Link
                  href={`/producciones/${production.id}`}
                  className="inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  Ver
                </Link>

              </div>

            </div>
          );
        }
      )}

    </div>
  );
}

/*
 * =====================================
 * SECCIÓN
 * =====================================
 */

function ProductionSection({
  title,
  description,
  count,
  icon,
  children,
  secondary = false,
}: {
  title: string;
  description: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <section
      className={`mt-6 overflow-hidden rounded-xl border ${
        secondary
          ? "border-white/[0.06] bg-[#080A0C]"
          : "border-white/10 bg-[#0B0F12]"
      }`}
    >

      <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

        <div className="flex items-center gap-3">

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

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
          {count}
        </span>

      </div>

      {children}

    </section>
  );
}

/*
 * =====================================
 * MÉTRICAS
 * =====================================
 */

function MetricCard({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger
          ? "border-red-900/30 bg-red-950/10"
          : "border-white/10 bg-[#0B0F12]"
      }`}
    >

      <div
        className={`flex items-center gap-2 text-xs ${
          danger
            ? "text-red-500"
            : "text-zinc-600"
        }`}
      >
        {icon}
        {label}
      </div>

      <p
        className={`mt-3 text-2xl font-semibold ${
          danger
            ? "text-red-400"
            : "text-zinc-100"
        }`}
      >
        {value}
      </p>

    </div>
  );
}

/*
 * =====================================
 * ESTADOS
 * =====================================
 */

function ProductionStatusBadge({
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
        "border-zinc-700 bg-zinc-900 text-zinc-400",
    },

    PENDING_DATE: {
      label:
        "Pendiente fecha",

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
        "Lista",

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

  const current =
    config[status] ?? {
      label: status,

      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] ${current.className}`}
    >
      {
        current.label
      }
    </span>
  );
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

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
      day:
        "2-digit",
      month:
        "2-digit",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function isPreparationOverdue(
  production: ProductionItem
) {
  if (
    !production.preparation_review_at
  ) {
    return false;
  }

  if (
    [
      "READY",
      "COMPLETED",
      "CANCELLED",
      "NOT_COMPLETED",
    ].includes(
      production.status
    )
  ) {
    return false;
  }

  return (
    new Date(
      production.preparation_review_at
    ) <
    new Date()
  );
}

function CircleUserRoundIcon() {
  return (
    <span className="flex h-3 w-3 items-center justify-center rounded-full border border-zinc-700">
      <span className="h-1 w-1 rounded-full bg-zinc-600" />
    </span>
  );
}