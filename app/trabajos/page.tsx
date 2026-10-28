import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Plus,
  Search,
} from "lucide-react";

export default async function JobsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(`
      id,
      name,
      status,
      general_deadline,
      created_at,

      projects:project_id (
        id,
        name,
        clients:client_id (
          name
        )
      ),

      job_categories:category_id (
        name
      ),

      profiles:responsible_user_id (
        full_name
      )
    `)
    .order("created_at", { ascending: false });

  const jobIds = jobs?.map((job) => job.id) ?? [];

  let nextSteps: {
    job_id: string | null;
    description: string;
  }[] = [];

  if (jobIds.length > 0) {
    const { data } = await supabase
      .from("pending_items")
      .select(`
        job_id,
        description
      `)
      .in("job_id", jobIds)
      .eq("status", "PENDING")
      .eq("is_next_step", true);

    nextSteps = data ?? [];
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Volver al Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
                <BriefcaseBusiness size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Trabajos
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Seguimiento operativo de todos los Trabajos de AeroPro.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500">
              <Search size={17} />
              Buscar Trabajo...
            </div>

            <Link
              href="/trabajos/nuevo"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus size={17} />
              Nuevo Trabajo
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar los Trabajos.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="grid grid-cols-[1.35fr_1.1fr_1.1fr_1fr_1fr_1fr_1.2fr_110px] border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
              <div>Trabajo</div>
              <div>Cliente</div>
              <div>Proyecto</div>
              <div>Categoría</div>
              <div>Responsable</div>
              <div>Estado</div>
              <div>Próximo paso</div>
              <div className="text-right">Acciones</div>
            </div>

            {!jobs || jobs.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                  <BriefcaseBusiness size={20} />
                </div>

                <p className="text-sm font-medium text-zinc-300">
                  Todavía no hay Trabajos
                </p>

                <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
                  Los Trabajos creados directamente o generados desde una
                  Solicitud aparecerán acá.
                </p>

                <Link
                  href="/trabajos/nuevo"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#20A4DD] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  <Plus size={16} />
                  Crear primer Trabajo
                </Link>
              </div>
            ) : (
              <div>
                {jobs.map((job) => {
                  const projectName = relationValue(
                    job.projects,
                    "name"
                  );

                  const projectObject = Array.isArray(job.projects)
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

                  const categoryName = relationValue(
                    job.job_categories,
                    "name"
                  );

                  const responsibleName = relationValue(
                    job.profiles,
                    "full_name"
                  );

                  const nextStep =
                    nextSteps.find(
                      (item) =>
                        item.job_id === job.id
                    )?.description ?? null;

                  return (
                    <div
                      key={job.id}
                      className="grid grid-cols-[1.35fr_1.1fr_1.1fr_1fr_1fr_1fr_1.2fr_110px] items-center border-b border-white/5 px-5 py-4 text-sm last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <div>
                        <Link
                          href={`/trabajos/${job.id}`}
                          className="font-medium text-zinc-100 transition hover:text-[#45B8E8]"
                        >
                          {job.name}
                        </Link>

                        {job.general_deadline && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                            <CalendarDays size={12} />

                            {formatDate(
                              job.general_deadline
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-zinc-400">
                        {clientName ??
                          "Sin cliente"}
                      </div>

                      <div className="text-zinc-400">
                        {projectName ??
                          "Sin proyecto"}
                      </div>

                      <div className="text-zinc-400">
                        {categoryName ??
                          "Sin categoría"}
                      </div>

                      <div className="text-zinc-400">
                        {responsibleName ??
                          "Sin responsable"}
                      </div>

                      <div>
                        <JobStatusBadge
                          status={job.status}
                        />
                      </div>

                      <div>
                        {nextStep ? (
                          <p className="line-clamp-2 text-xs leading-5 text-zinc-400">
                            {nextStep}
                          </p>
                        ) : (
                          <span className="text-xs text-zinc-700">
                            Sin próximo paso
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <Link
                          href={`/trabajos/${job.id}`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        >
                          Ver
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function relationValue(
  relation: unknown,
  property: string
): string | undefined {
  if (!relation) {
    return undefined;
  }

  if (Array.isArray(relation)) {
    const first = relation[0] as
      | Record<string, unknown>
      | undefined;

    const value = first?.[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  if (typeof relation === "object") {
    const value = (
      relation as Record<string, unknown>
    )[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  return undefined;
}

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
      label: "Pendiente planificación",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    IN_PLANNING: {
      label: "En planificación",
      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    PLANNED: {
      label: "Planificado",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    PAUSED: {
      label: "Pausado",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    CANCELLED: {
      label: "Cancelado",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    COMPLETED: {
      label: "Completado",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    ARCHIVED: {
      label: "Archivado",
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
}