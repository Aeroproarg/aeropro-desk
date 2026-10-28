"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  clients: { name: string } | { name: string }[] | null;
};

function projectLabel(project: Project) {
  const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
  return client?.name ? `${project.name} · ${client.name}` : project.name;
}

type Profile = {
  id: string;
  full_name: string;
};

type JobCategory = {
  id: string;
  name: string;
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

// Crear un Trabajo directamente, sin pasar por una Solicitud.
// Acepta ?proyecto=<id> para dejar el proyecto ya elegido.
export default function NewJobPage() {
  const router = useRouter();

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

  const [brief, setBrief] = useState("");
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
          projectResult,
          profileResult,
          categoryResult,
        ] = await Promise.all([
          supabase
            .from("projects")
            .select("id, name, client_id, clients:client_id ( name )")
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
        ]);

        if (
          projectResult.error ||
          profileResult.error ||
          categoryResult.error
        ) {
          throw new Error(
            "No se pudieron cargar los datos para crear el Trabajo."
          );
        }

        const loadedProjects = (projectResult.data ?? []) as Project[];
        const presetProject = new URLSearchParams(window.location.search).get("proyecto");
        if (presetProject && loadedProjects.some((project) => project.id === presetProject)) {
          setProjectId(presetProject);
        }

        // Por defecto, el responsable es quien crea el Trabajo (si está activo).
        if ((profileResult.data ?? []).some((profile) => profile.id === user.id)) {
          setResponsibleUserId(user.id);
        }

        setProjects(loadedProjects);
        setProfiles(profileResult.data ?? []);
        setCategories(categoryResult.data ?? []);
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
  }, [router]);

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
      const { data: createdJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
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
          // En la base es obligatorio: si se deja vacío, se guarda como texto en blanco.
          original_brief: brief.trim(),
        })
        .select("id")
        .single();

      if (jobError || !createdJob) {
        throw jobError ?? new Error("No se creó el Trabajo.");
      }

      const trimmedNextStep =
        nextStepDescription.trim();

      if (trimmedNextStep) {
        const { error: pendingInsertError } =
          await supabase
            .from("pending_items")
            .insert({
              job_id: createdJob.id,
              description: trimmedNextStep,
              responsible_user_id:
                responsibleUserId,
              status: "PENDING",
              is_next_step: true,
              blocks_editing: false,
            });

        if (pendingInsertError) {
          // El Trabajo ya existe: se avisa y se abre igual para cargar el paso desde Editar.
          console.error(pendingInsertError);
          router.replace(`/trabajos/${createdJob.id}?aviso=proximo-paso`);
          router.refresh();
          return;
        }
      }

      router.replace(`/trabajos/${createdJob.id}`);
      router.refresh();
    } catch (error) {
      console.error(
        "Error creating job:",
        error
      );

      setErrorMessage(
        "No se pudo crear el Trabajo. Revisá los datos o tus permisos."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <Link
          href="/trabajos"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Trabajos
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <BriefcaseBusiness size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Nuevo Trabajo
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Creá un Trabajo directamente, sin pasar por una Solicitud.
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
                    {projectLabel(project)}
                  </option>
                ))}
              </select>

              {selectedProject && (
                <p className="mt-2 text-xs text-zinc-600">
                  {projectLabel(selectedProject)}
                </p>
              )}

              {projects.length === 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  No hay proyectos. Primero{" "}
                  <Link href="/proyectos/nuevo" className="underline">
                    creá un proyecto
                  </Link>
                  .
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

            <Field label="Brief / descripción">
              <textarea
                rows={4}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Qué pidió el cliente, objetivo, referencias..."
                className={`${inputClass} resize-none leading-6`}
              />
            </Field>

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
                href="/trabajos"
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
                  ? "Creando..."
                  : "Crear Trabajo"}
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
