"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type JobCategory = {
  id: string;
  name: string;
};

type RequestData = {
  id: string;
  title: string;
  initial_brief: string;
  project_id: string;
  responsible_user_id: string;
  status: string;
};

type JobDraft = {
  tempId: string;
  name: string;
  categoryId: string;
};

export default function GenerateJobsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [categories, setCategories] = useState<JobCategory[]>([]);

  const [jobs, setJobs] = useState<JobDraft[]>([
    {
      tempId: crypto.randomUUID(),
      name: "",
      categoryId: "",
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const [
          requestResult,
          categoriesResult,
        ] = await Promise.all([
          supabase
            .from("requests")
            .select(`
              id,
              title,
              initial_brief,
              project_id,
              responsible_user_id,
              status
            `)
            .eq("id", id)
            .single(),

          supabase
            .from("job_categories")
            .select("id, name")
            .order("name", { ascending: true }),
        ]);

        if (
          requestResult.error ||
          !requestResult.data
        ) {
          throw new Error(
            "No se pudo cargar la solicitud."
          );
        }

        if (categoriesResult.error) {
          throw new Error(
            "No se pudieron cargar las categorías de Trabajo."
          );
        }

        if (
          requestResult.data.status !== "CONFIRMED"
        ) {
          throw new Error(
            "La solicitud debe estar Confirmada antes de generar Trabajos."
          );
        }

        setRequestData(requestResult.data);
        setCategories(categoriesResult.data ?? []);

        setJobs([
          {
            tempId: crypto.randomUUID(),
            name: requestResult.data.title ?? "",
            categoryId: "",
          },
        ]);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, router]);

  function addJob() {
    setJobs((currentJobs) => [
      ...currentJobs,
      {
        tempId: crypto.randomUUID(),
        name: "",
        categoryId: "",
      },
    ]);
  }

  function removeJob(tempId: string) {
    setJobs((currentJobs) => {
      if (currentJobs.length === 1) {
        return currentJobs;
      }

      return currentJobs.filter(
        (job) => job.tempId !== tempId
      );
    });
  }

  function updateJob(
    tempId: string,
    field: "name" | "categoryId",
    value: string
  ) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.tempId === tempId
          ? {
              ...job,
              [field]: value,
            }
          : job
      )
    );
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!requestData) {
      return;
    }

    setErrorMessage("");

    const hasInvalidJob = jobs.some(
      (job) =>
        !job.name.trim() ||
        !job.categoryId
    );

    if (hasInvalidJob) {
      setErrorMessage(
        "Completá nombre y categoría en todos los Trabajos."
      );
      return;
    }

    setSaving(true);

    try {
      const rows = jobs.map((job) => ({
        project_id:
          requestData.project_id,

        source_request_id:
          requestData.id,

        name:
          job.name.trim(),

        category_id:
          job.categoryId,

        responsible_user_id:
          requestData.responsible_user_id,

        status:
          "PENDING_PLANNING",

        original_brief:
          requestData.initial_brief,
      }));

      const { error } = await supabase
        .from("jobs")
        .insert(rows);

      if (error) {
        throw error;
      }

      router.replace(
        `/solicitudes/${requestData.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error creating jobs:",
        error
      );

      setErrorMessage(
        "No se pudieron crear los Trabajos."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando solicitud...
        </p>
      </main>
    );
  }

  if (!requestData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <div className="max-w-md text-center">
          <p className="text-sm text-red-400">
            {errorMessage ||
              "No se pudo cargar la solicitud."}
          </p>

          <Link
            href={`/solicitudes/${id}`}
            className="mt-5 inline-flex text-sm text-[#45B8E8]"
          >
            Volver a la solicitud
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <Link
          href={`/solicitudes/${id}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a la solicitud
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <BriefcaseBusiness size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Generar Trabajos
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Convertí la solicitud confirmada en uno o varios Trabajos.
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-white/10 bg-[#0B0F12] p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">
            Solicitud de origen
          </p>

          <h2 className="mt-2 text-lg font-semibold">
            {requestData.title}
          </h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
            {requestData.initial_brief}
          </p>
        </section>

        <form onSubmit={handleSubmit}>
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-sm font-semibold">
                  Trabajos a generar
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Cada Trabajo puede tener una categoría diferente.
                </p>
              </div>

              <button
                type="button"
                onClick={addJob}
                className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                <Plus size={15} />
                Agregar Trabajo
              </button>
            </div>

            <div className="space-y-4 p-6">
              {jobs.map((job, index) => (
                <div
                  key={job.tempId}
                  className="rounded-xl border border-white/10 bg-[#07090B] p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#45B8E8]">
                        Trabajo {index + 1}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeJob(job.tempId)
                      }
                      disabled={jobs.length === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-950/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-20"
                      title="Eliminar Trabajo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Nombre
                        <span className="ml-1 text-[#20A4DD]">
                          *
                        </span>
                      </label>

                      <input
                        type="text"
                        value={job.name}
                        onChange={(e) =>
                          updateJob(
                            job.tempId,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Ej. Video avance de obra"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Categoría
                        <span className="ml-1 text-[#20A4DD]">
                          *
                        </span>
                      </label>

                      <select
                        value={job.categoryId}
                        onChange={(e) =>
                          updateJob(
                            job.tempId,
                            "categoryId",
                            e.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Seleccionar categoría
                        </option>

                        {categories.map(
                          (category) => (
                            <option
                              key={category.id}
                              value={category.id}
                            >
                              {category.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/5 bg-black/20 px-4 py-3">
                    <p className="text-xs leading-5 text-zinc-600">
                      Este Trabajo heredará automáticamente el Proyecto,
                      Responsable y Brief original de la Solicitud.
                    </p>
                  </div>
                </div>
              ))}

              {errorMessage && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">
              <p className="text-xs text-zinc-700">
                Se crearán {jobs.length}{" "}
                {jobs.length === 1
                  ? "Trabajo"
                  : "Trabajos"}
              </p>

              <div className="flex gap-3">
                <Link
                  href={`/solicitudes/${id}`}
                  className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  Cancelar
                </Link>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />

                  {saving
                    ? "Generando..."
                    : jobs.length === 1
                    ? "Generar Trabajo"
                    : `Generar ${jobs.length} Trabajos`}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]";