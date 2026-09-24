"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ListChecks,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Project = {
  id: string;
  name: string;
  client_id: string;
};

type Profile = {
  id: string;
  full_name: string;
};

type JobCategory = {
  id: string;
  name: string;
};

type JobData = {
  id: string;
  name: string;
  project_id: string;
  category_id: string;
  responsible_user_id: string;
  status: string;
  general_deadline: string | null;
};

type PendingItem = {
  id: string;
  description: string;
  is_next_step: boolean;
  status: string;
};

const JOB_STATUSES = [
  {
    value: "PENDING_PLANNING",
    label: "Pendiente de planificación",
  },
  {
    value: "IN_PLANNING",
    label: "En planificación",
  },
  {
    value: "PLANNED",
    label: "Planificado",
  },
  {
    value: "PAUSED",
    label: "Pausado",
  },
  {
    value: "CANCELLED",
    label: "Cancelado",
  },
  {
    value: "COMPLETED",
    label: "Completado",
  },
  {
    value: "ARCHIVED",
    label: "Archivado",
  },
];

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const loadedRef = useRef(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [status, setStatus] = useState("PENDING_PLANNING");
  const [generalDeadline, setGeneralDeadline] = useState("");

  const [nextStepId, setNextStepId] = useState<string | null>(null);
  const [nextStepDescription, setNextStepDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

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
          jobResult,
          projectResult,
          profileResult,
          categoryResult,
          pendingResult,
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select(`
              id,
              name,
              project_id,
              category_id,
              responsible_user_id,
              status,
              general_deadline
            `)
            .eq("id", id)
            .single(),

          supabase
            .from("projects")
            .select("id, name, client_id")
            .order("name", { ascending: true }),

          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("status", "ACTIVE")
            .order("full_name", { ascending: true }),

          supabase
            .from("job_categories")
            .select("id, name")
            .order("name", { ascending: true }),

          supabase
            .from("pending_items")
            .select(`
              id,
              description,
              is_next_step,
              status
            `)
            .eq("job_id", id)
            .eq("status", "PENDING")
            .eq("is_next_step", true)
            .limit(1),
        ]);

        if (jobResult.error || !jobResult.data) {
          throw new Error(
            "No se pudo cargar el Trabajo."
          );
        }

        if (
          projectResult.error ||
          profileResult.error ||
          categoryResult.error ||
          pendingResult.error
        ) {
          throw new Error(
            "No se pudieron cargar los datos auxiliares."
          );
        }

        const job = jobResult.data as JobData;

        setName(job.name ?? "");
        setProjectId(job.project_id ?? "");
        setCategoryId(job.category_id ?? "");
        setResponsibleUserId(job.responsible_user_id ?? "");
        setStatus(job.status ?? "PENDING_PLANNING");

        setGeneralDeadline(
          toLocalDateInput(job.general_deadline)
        );

        const existingNextStep =
          (pendingResult.data?.[0] as PendingItem | undefined) ?? null;

        if (existingNextStep) {
          setNextStepId(existingNextStep.id);
          setNextStepDescription(
            existingNextStep.description ?? ""
          );
        }

        setProjects(projectResult.data ?? []);
        setProfiles(profileResult.data ?? []);
        setCategories(categoryResult.data ?? []);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el Trabajo."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, router]);

  const selectedProject = useMemo(() => {
    return projects.find(
      (project) => project.id === projectId
    );
  }, [projectId, projects]);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving) return;

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Ingresá un nombre.");
      return;
    }

    if (!projectId) {
      setErrorMessage("Seleccioná un proyecto.");
      return;
    }

    if (!categoryId) {
      setErrorMessage("Seleccioná una categoría.");
      return;
    }

    if (!responsibleUserId) {
      setErrorMessage("Seleccioná un responsable.");
      return;
    }

    if (
      status === "IN_PLANNING" &&
      !nextStepDescription.trim()
    ) {
      setErrorMessage(
        "Un Trabajo En planificación debe tener un Próximo paso."
      );
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const { error: jobError } = await supabase
        .from("jobs")
        .update({
          name: name.trim(),
          project_id: projectId,
          category_id: categoryId,
          responsible_user_id: responsibleUserId,
          status,
          general_deadline: generalDeadline
            ? new Date(
                `${generalDeadline}T12:00:00`
              ).toISOString()
            : null,
          updated_at: now,
        })
        .eq("id", id);

      if (jobError) {
        throw jobError;
      }

      const trimmedNextStep =
        nextStepDescription.trim();

      if (trimmedNextStep) {
        if (nextStepId) {
          const { error: pendingUpdateError } =
            await supabase
              .from("pending_items")
              .update({
                description: trimmedNextStep,
                responsible_user_id:
                  responsibleUserId,
                is_next_step: true,
                status: "PENDING",
                updated_at: now,
              })
              .eq("id", nextStepId);

          if (pendingUpdateError) {
            throw pendingUpdateError;
          }
        } else {
          const { data: insertedPending, error: pendingInsertError } =
            await supabase
              .from("pending_items")
              .insert({
                job_id: id,
                description: trimmedNextStep,
                responsible_user_id:
                  responsibleUserId,
                status: "PENDING",
                is_next_step: true,
                blocks_editing: false,
              })
              .select("id")
              .single();

          if (pendingInsertError) {
            throw pendingInsertError;
          }

          if (insertedPending) {
            setNextStepId(insertedPending.id);
          }
        }
      } else if (nextStepId) {
        const { error: resolveError } = await supabase
          .from("pending_items")
          .update({
            status: "RESOLVED",
            is_next_step: false,
            updated_at: now,
          })
          .eq("id", nextStepId);

        if (resolveError) {
          throw resolveError;
        }
      }

      router.replace(`/trabajos/${id}`);
      router.refresh();
    } catch (error) {
      console.error(
        "Error updating job:",
        error
      );

      setErrorMessage(
        "No se pudieron guardar los cambios."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando Trabajo...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <Link
          href={`/trabajos/${id}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver al Trabajo
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <BriefcaseBusiness size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar Trabajo
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Actualizá planificación, responsable y próximo paso.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Información general
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Datos principales del Trabajo.
            </p>
          </div>

          <div className="space-y-7 p-6">
            <Field label="Nombre" required>
              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Proyecto" required>
              <select
                value={projectId}
                onChange={(e) =>
                  setProjectId(e.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  Seleccionar proyecto
                </option>

                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                ))}
              </select>

              {selectedProject && (
                <p className="mt-2 text-xs text-zinc-600">
                  Proyecto actual:{" "}
                  {selectedProject.name}
                </p>
              )}
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Categoría" required>
                <select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">
                    Seleccionar categoría
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Responsable" required>
                <select
                  value={responsibleUserId}
                  onChange={(e) =>
                    setResponsibleUserId(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Seleccionar responsable
                  </option>

                  {profiles.map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Estado" required>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  className={inputClass}
                >
                  {JOB_STATUSES.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Deadline general">
                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                  />

                  <input
                    type="date"
                    value={generalDeadline}
                    onChange={(e) =>
                      setGeneralDeadline(
                        e.target.value
                      )
                    }
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </Field>
            </div>

            <section className="rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/[0.04] p-5">
              <div className="mb-5 flex items-start gap-3">
                <div className="mt-0.5 text-[#45B8E8]">
                  <ListChecks size={18} />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Próximo paso
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Una acción concreta que indique qué hay que hacer
                    después para mover este Trabajo.
                  </p>
                </div>
              </div>

              <Field
                label="Acción siguiente"
                required={status === "IN_PLANNING"}
              >
                <textarea
                  rows={4}
                  value={nextStepDescription}
                  onChange={(e) =>
                    setNextStepDescription(
                      e.target.value
                    )
                  }
                  placeholder="Ej. Confirmar fecha de rodaje con el cliente"
                  className={`${inputClass} resize-none leading-6`}
                />
              </Field>

              {status === "IN_PLANNING" && (
                <p className="mt-3 text-xs text-[#45B8E8]">
                  En planificación requiere un Próximo paso.
                </p>
              )}
            </section>

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">
            <p className="text-xs text-zinc-700">
              * Campos obligatorios
            </p>

            <div className="flex gap-3">
              <Link
                href={`/trabajos/${id}`}
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
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && (
          <span className="ml-1 text-[#20A4DD]">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function toLocalDateInput(
  value: string | null
) {
  if (!value) return "";

  const date = new Date(value);

  return date.toISOString().slice(0, 10);
}