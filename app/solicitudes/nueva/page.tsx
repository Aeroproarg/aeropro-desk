"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type Client = {
  id: string;
  name: string;
  main_responsible_user_id: string | null;
};

type Project = {
  id: string;
  name: string;
  client_id: string;
  main_responsible_user_id: string;
};

type Profile = {
  id: string;
  full_name: string;
};

type SourceChannel = {
  id: string;
  name: string;
};

type CloseReason = {
  id: string;
  name: string;
};

const REQUEST_STATUSES = [
  {
    value: "NEW",
    label: "Nueva solicitud",
  },
  {
    value: "IN_DEFINITION",
    label: "En definición",
  },
  {
    value: "WAITING_CLIENT",
    label: "Esperando cliente",
  },
  {
    value: "CONFIRMED",
    label: "Confirmada",
  },
  {
    value: "POSTPONED",
    label: "Postergada",
  },
  {
    value: "DID_NOT_ADVANCE",
    label: "No avanzó",
  },
  {
    value: "CANCELLED",
    label: "Cancelada",
  },
];

export default function NewRequestPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sourceChannels, setSourceChannels] = useState<SourceChannel[]>([]);
  const [closeReasons, setCloseReasons] = useState<CloseReason[]>([]);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [initialBrief, setInitialBrief] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [status, setStatus] = useState("NEW");
  const [sourceChannelId, setSourceChannelId] = useState("");

  const [nextFollowupAt, setNextFollowupAt] = useState("");
  const [lastContactNote, setLastContactNote] = useState("");
  const [resumeAt, setResumeAt] = useState("");

  const [closeReasonId, setCloseReasonId] = useState("");
  const [closeComment, setCloseComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [
        { data: clientData, error: clientError },
        { data: projectData, error: projectError },
        { data: profileData, error: profileError },
        { data: channelData, error: channelError },
        { data: reasonData, error: reasonError },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, main_responsible_user_id")
          .eq("status", "ACTIVE")
          .order("name", { ascending: true }),

        supabase
          .from("projects")
          .select("id, name, client_id, main_responsible_user_id")
          .eq("status", "ACTIVE")
          .order("name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("status", "ACTIVE")
          .order("full_name", { ascending: true }),

        supabase
          .from("request_source_channels")
          .select("id, name")
          .order("name", { ascending: true }),

        supabase
          .from("request_close_reasons")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (
        clientError ||
        projectError ||
        profileError ||
        channelError ||
        reasonError
      ) {
        setErrorMessage(
          "No se pudieron cargar los datos necesarios para crear la solicitud."
        );
        setLoading(false);
        return;
      }

      setClients(clientData ?? []);
      setProjects(projectData ?? []);
      setProfiles(profileData ?? []);
      setSourceChannels(channelData ?? []);
      setCloseReasons(reasonData ?? []);

      setResponsibleUserId(user.id);

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const filteredProjects = useMemo(() => {
    if (!clientId) {
      return [];
    }

    return projects.filter(
      (project) => project.client_id === clientId
    );
  }, [clientId, projects]);

  function handleClientChange(selectedClientId: string) {
    setClientId(selectedClientId);
    setProjectId("");

    const selectedClient = clients.find(
      (client) => client.id === selectedClientId
    );

    if (selectedClient?.main_responsible_user_id) {
      setResponsibleUserId(
        selectedClient.main_responsible_user_id
      );
    }
  }

  function handleProjectChange(selectedProjectId: string) {
    setProjectId(selectedProjectId);

    const selectedProject = projects.find(
      (project) => project.id === selectedProjectId
    );

    if (selectedProject?.main_responsible_user_id) {
      setResponsibleUserId(
        selectedProject.main_responsible_user_id
      );
    }
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setErrorMessage("");

    if (!clientId) {
      setErrorMessage("Seleccioná un cliente.");
      return;
    }

    if (!projectId) {
      setErrorMessage("Seleccioná un proyecto.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Ingresá un título para la solicitud.");
      return;
    }

    if (!initialBrief.trim()) {
      setErrorMessage("Ingresá el brief inicial.");
      return;
    }

    if (!responsibleUserId) {
      setErrorMessage("Seleccioná un responsable.");
      return;
    }

    if (
      status === "WAITING_CLIENT" &&
      !nextFollowupAt
    ) {
      setErrorMessage(
        "Para una solicitud en Esperando cliente, definí el próximo seguimiento."
      );
      return;
    }

    if (
      status === "POSTPONED" &&
      !resumeAt
    ) {
      setErrorMessage(
        "Para una solicitud Postergada, definí cuándo retomarla."
      );
      return;
    }

    if (
      (status === "DID_NOT_ADVANCE" ||
        status === "CANCELLED") &&
      !closeReasonId
    ) {
      setErrorMessage(
        "Seleccioná un motivo de cierre."
      );
      return;
    }

    setSaving(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("requests")
      .insert({
        client_id: clientId,
        project_id: projectId,
        title: title.trim(),
        initial_brief: initialBrief.trim(),
        responsible_user_id: responsibleUserId,
        status,
        source_channel_id:
          sourceChannelId || null,

        next_followup_at:
          nextFollowupAt
            ? new Date(nextFollowupAt).toISOString()
            : null,

        last_contact_note:
          lastContactNote.trim() || null,

        last_contact_at:
          lastContactNote.trim()
            ? now
            : null,

        resume_at:
          resumeAt
            ? new Date(resumeAt).toISOString()
            : null,

        close_reason_id:
          closeReasonId || null,

        close_comment:
          closeComment.trim() || null,

        confirmed_at:
          status === "CONFIRMED"
            ? now
            : null,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        "No se pudo crear la solicitud."
      );

      setSaving(false);
      return;
    }

    router.push("/solicitudes");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando datos...
        </p>
      </main>
    );
  }

  const showFollowup =
    status === "WAITING_CLIENT";

  const showResume =
    status === "POSTPONED";

  const showClose =
    status === "DID_NOT_ADVANCE" ||
    status === "CANCELLED";

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <Link
          href="/solicitudes"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Solicitudes
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <ClipboardList size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Nueva solicitud
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Registrá un nuevo pedido o necesidad de un cliente.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Datos principales
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Toda solicitud debe pertenecer a un cliente y a un proyecto.
            </p>
          </div>

          <div className="space-y-7 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="client"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Cliente
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="client"
                  required
                  value={clientId}
                  onChange={(e) =>
                    handleClientChange(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="">
                    Seleccionar cliente
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="project"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Proyecto
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="project"
                  required
                  disabled={!clientId}
                  value={projectId}
                  onChange={(e) =>
                    handleProjectChange(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD] disabled:opacity-40"
                >
                  <option value="">
                    {!clientId
                      ? "Primero seleccioná un cliente"
                      : "Seleccionar proyecto"}
                  </option>

                  {filteredProjects.map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Título de la solicitud
                <span className="ml-1 text-[#20A4DD]">*</span>
              </label>

              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cobertura audiovisual evento septiembre"
                className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />
            </div>

            <div>
              <label
                htmlFor="brief"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Brief inicial
                <span className="ml-1 text-[#20A4DD]">*</span>
              </label>

              <textarea
                id="brief"
                rows={7}
                required
                value={initialBrief}
                onChange={(e) =>
                  setInitialBrief(e.target.value)
                }
                placeholder="Escribí el pedido tal como llegó, incluso si todavía está poco definido..."
                className="w-full resize-none rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />

              <p className="mt-2 text-xs text-zinc-700">
                Este texto después quedará como registro del pedido original.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="responsible"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Responsable
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="responsible"
                  required
                  value={responsibleUserId}
                  onChange={(e) =>
                    setResponsibleUserId(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
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
              </div>

              <div>
                <label
                  htmlFor="source"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Canal de ingreso
                </label>

                <select
                  id="source"
                  value={sourceChannelId}
                  onChange={(e) =>
                    setSourceChannelId(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="">
                    Sin especificar
                  </option>

                  {sourceChannels.map((channel) => (
                    <option
                      key={channel.id}
                      value={channel.id}
                    >
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Estado
              </label>

              <select
                id="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
              >
                {REQUEST_STATUSES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {showFollowup && (
              <section className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <CalendarClock
                    size={18}
                    className="text-amber-400"
                  />

                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Seguimiento con cliente
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Definí cuándo corresponde volver a contactar.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="followup"
                      className="mb-2 block text-sm font-medium text-zinc-300"
                    >
                      Próximo seguimiento
                      <span className="ml-1 text-amber-400">*</span>
                    </label>

                    <input
                      id="followup"
                      type="datetime-local"
                      value={nextFollowupAt}
                      onChange={(e) =>
                        setNextFollowupAt(e.target.value)
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contactNote"
                      className="mb-2 block text-sm font-medium text-zinc-300"
                    >
                      Último contacto / contexto
                    </label>

                    <input
                      id="contactNote"
                      type="text"
                      value={lastContactNote}
                      onChange={(e) =>
                        setLastContactNote(e.target.value)
                      }
                      placeholder="Ej. Esperando confirmación de fecha"
                      className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-600"
                    />
                  </div>
                </div>
              </section>
            )}

            {showResume && (
              <section className="rounded-xl border border-orange-900/30 bg-orange-950/10 p-5">
                <label
                  htmlFor="resume"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Retomar solicitud
                  <span className="ml-1 text-orange-400">*</span>
                </label>

                <input
                  id="resume"
                  type="datetime-local"
                  value={resumeAt}
                  onChange={(e) =>
                    setResumeAt(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-orange-600"
                />
              </section>
            )}

            {showClose && (
              <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="closeReason"
                      className="mb-2 block text-sm font-medium text-zinc-300"
                    >
                      Motivo
                      <span className="ml-1 text-red-400">*</span>
                    </label>

                    <select
                      id="closeReason"
                      value={closeReasonId}
                      onChange={(e) =>
                        setCloseReasonId(e.target.value)
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-red-700"
                    >
                      <option value="">
                        Seleccionar motivo
                      </option>

                      {closeReasons.map((reason) => (
                        <option
                          key={reason.id}
                          value={reason.id}
                        >
                          {reason.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="closeComment"
                      className="mb-2 block text-sm font-medium text-zinc-300"
                    >
                      Comentario
                    </label>

                    <input
                      id="closeComment"
                      type="text"
                      value={closeComment}
                      onChange={(e) =>
                        setCloseComment(e.target.value)
                      }
                      placeholder="Contexto adicional..."
                      className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-700"
                    />
                  </div>
                </div>
              </section>
            )}

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
                href="/solicitudes"
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
                  : "Crear solicitud"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}