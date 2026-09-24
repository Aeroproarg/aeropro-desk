"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Check,
  Film,
  Save,
  Search,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type JobRow = {
  id: string;
  name: string;
  status: string;
  project_id: string | null;
  projects:
    | {
        id: string;
        name: string;
        clients:
          | {
              id: string;
              name: string;
            }
          | {
              id: string;
              name: string;
            }[]
          | null;
      }
    | {
        id: string;
        name: string;
        clients:
          | {
              id: string;
              name: string;
            }
          | {
              id: string;
              name: string;
            }[]
          | null;
      }[]
    | null;
};

export default function ProductionJobsPage() {
  const params = useParams();
  const router = useRouter();

  const productionId =
    params.id as string;

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    productionName,
    setProductionName,
  ] = useState("");

  const [
    jobs,
    setJobs,
  ] = useState<JobRow[]>([]);

  const [
    selectedJobIds,
    setSelectedJobIds,
  ] = useState<string[]>([]);

  const [
    search,
    setSearch,
  ] = useState("");

  /*
   * =====================================
   * CARGAR DATOS
   * =====================================
   */

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      const [
        productionResult,
        jobsResult,
        linkedJobsResult,
      ] = await Promise.all([
        supabase
          .from("productions")
          .select(`
            id,
            name
          `)
          .eq(
            "id",
            productionId
          )
          .single(),

        supabase
          .from("jobs")
          .select(`
            id,
            name,
            status,
            project_id,

            projects:project_id (
              id,
              name,

              clients:client_id (
                id,
                name
              )
            )
          `)
          .not(
            "status",
            "in",
            "(CANCELLED,ARCHIVED)"
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          ),

        supabase
          .from("production_jobs")
          .select(`
            job_id
          `)
          .eq(
            "production_id",
            productionId
          ),
      ]);

      if (
        productionResult.error ||
        !productionResult.data
      ) {
        console.error(
          productionResult.error
        );

        setErrorMessage(
          "No se pudo cargar la producción."
        );

        setLoading(false);

        return;
      }

      if (jobsResult.error) {
        console.error(
          jobsResult.error
        );

        setErrorMessage(
          "No se pudieron cargar los trabajos."
        );

        setLoading(false);

        return;
      }

      if (linkedJobsResult.error) {
        console.error(
          linkedJobsResult.error
        );

        setErrorMessage(
          "No se pudieron cargar los trabajos vinculados."
        );

        setLoading(false);

        return;
      }

      setProductionName(
        productionResult.data.name
      );

      setJobs(
        (jobsResult.data ??
          []) as JobRow[]
      );

      setSelectedJobIds(
        (
          linkedJobsResult.data ??
          []
        ).map(
          (row) =>
            row.job_id
        )
      );

      setLoading(false);
    }

    if (productionId) {
      loadData();
    }
  }, [productionId]);

  /*
   * =====================================
   * FILTRO
   * =====================================
   */

  const filteredJobs =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      if (!normalized) {
        return jobs;
      }

      return jobs.filter(
        (job) => {
          const project =
            firstRelation(
              job.projects
            );

          const client =
            firstRelation(
              project?.clients
            );

          const text = [
            job.name,
            project?.name,
            client?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            normalized
          );
        }
      );
    }, [
      jobs,
      search,
    ]);

  /*
   * =====================================
   * SELECCIÓN
   * =====================================
   */

  function toggleJob(
    jobId: string
  ) {
    setSelectedJobIds(
      (current) => {
        if (
          current.includes(
            jobId
          )
        ) {
          return current.filter(
            (id) =>
              id !==
              jobId
          );
        }

        return [
          ...current,
          jobId,
        ];
      }
    );
  }

  /*
   * =====================================
   * GUARDAR
   * =====================================
   */

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    setErrorMessage("");

    try {
      /*
       * Primero leemos lo que ya existe.
       */

      const {
        data: currentLinks,
        error:
          currentLinksError,
      } = await supabase
        .from("production_jobs")
        .select(`
          job_id
        `)
        .eq(
          "production_id",
          productionId
        );

      if (
        currentLinksError
      ) {
        throw currentLinksError;
      }

      const currentIds =
        (
          currentLinks ??
          []
        ).map(
          (row) =>
            row.job_id
        );

      /*
       * Qué hay que agregar
       */

      const toAdd =
        selectedJobIds.filter(
          (id) =>
            !currentIds.includes(
              id
            )
        );

      /*
       * Qué hay que quitar
       */

      const toRemove =
        currentIds.filter(
          (id) =>
            !selectedJobIds.includes(
              id
            )
        );

      /*
       * INSERTAR
       */

      if (
        toAdd.length >
        0
      ) {
        const {
          error:
            insertError,
        } = await supabase
          .from("production_jobs")
          .insert(
            toAdd.map(
              (jobId) => ({
                production_id:
                  productionId,

                job_id:
                  jobId,
              })
            )
          );

        if (insertError) {
          throw insertError;
        }
      }

      /*
       * ELIMINAR VÍNCULOS
       */

      if (
        toRemove.length >
        0
      ) {
        const {
          error:
            deleteError,
        } = await supabase
          .from("production_jobs")
          .delete()
          .eq(
            "production_id",
            productionId
          )
          .in(
            "job_id",
            toRemove
          );

        if (deleteError) {
          throw deleteError;
        }
      }

      router.push(
        `/producciones/${productionId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error linking jobs:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los trabajos vinculados."
      );

      setSaving(false);
    }
  }

  /*
   * =====================================
   * CARGANDO
   * =====================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">

        <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-6 py-10 text-center text-sm text-zinc-600">
            Cargando trabajos...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8">

          <Link
            href={`/producciones/${productionId}`}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />

            Volver a la producción
          </Link>

          <div className="flex items-start gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <Film
                size={21}
              />
            </div>

            <div>

              <h1 className="text-2xl font-semibold tracking-tight">
                Vincular trabajos
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {productionName}
              </p>

            </div>

          </div>

        </div>

        {/* =====================================
            BUSCADOR
        ===================================== */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 p-5">

            <div className="relative">

              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Buscar por trabajo, proyecto o cliente..."
                className="h-10 w-full rounded-lg border border-white/10 bg-[#050607] pl-9 pr-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />

            </div>

          </div>

          {/* =====================================
              LISTADO
          ===================================== */}

          {filteredJobs.length ===
          0 ? (

            <div className="px-6 py-12 text-center text-sm text-zinc-700">
              No hay trabajos para mostrar.
            </div>

          ) : (

            <div className="divide-y divide-white/5">

              {filteredJobs.map(
                (job) => {
                  const project =
                    firstRelation(
                      job.projects
                    );

                  const client =
                    firstRelation(
                      project?.clients
                    );

                  const selected =
                    selectedJobIds.includes(
                      job.id
                    );

                  return (
                    <button
                      key={
                        job.id
                      }
                      type="button"
                      onClick={() =>
                        toggleJob(
                          job.id
                        )
                      }
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025]"
                    >

                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                          selected
                            ? "border-[#20A4DD] bg-[#20A4DD] text-black"
                            : "border-white/10 bg-[#050607] text-transparent"
                        }`}
                      >
                        <Check
                          size={14}
                        />
                      </div>

                      <div className="min-w-0 flex-1">

                        <p className="truncate text-sm font-medium text-zinc-300">
                          {
                            job.name
                          }
                        </p>

                        <p className="mt-1 truncate text-xs text-zinc-700">
                          {client?.name ??
                            "Sin cliente"}
                          {" · "}
                          {project?.name ??
                            "Sin proyecto"}
                        </p>

                      </div>

                      <span className="hidden rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-zinc-600 sm:inline-flex">
                        {
                          formatJobStatus(
                            job.status
                          )
                        }
                      </span>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* =====================================
            ACCIONES
        ===================================== */}

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs text-zinc-600">
            {
              selectedJobIds.length
            }{" "}
            trabajo
            {
              selectedJobIds.length ===
              1
                ? ""
                : "s"
            }{" "}
            vinculado
            {
              selectedJobIds.length ===
              1
                ? ""
                : "s"
            }
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">

            <Link
              href={`/producciones/${productionId}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </Link>

            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <Save
                size={16}
              />

              {saving
                ? "Guardando..."
                : "Guardar vínculos"}

            </button>

          </div>

        </div>

      </div>

    </main>
  );
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

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

function formatJobStatus(
  value: string
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

    COMPLETED:
      "Completado",

    ARCHIVED:
      "Archivado",

    CANCELLED:
      "Cancelado",
  };

  return (
    labels[value] ??
    value
  );
}