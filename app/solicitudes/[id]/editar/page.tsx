"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Client = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  client_id: string;
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
  { value: "NEW", label: "Nueva solicitud" },
  { value: "IN_DEFINITION", label: "En definición" },
  { value: "WAITING_CLIENT", label: "Esperando cliente" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "POSTPONED", label: "Postergada" },
  { value: "DID_NOT_ADVANCE", label: "No avanzó" },
  { value: "CANCELLED", label: "Cancelada" },
];

export default function EditRequestPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const loadedRef = useRef(false);

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
  const [originalStatus, setOriginalStatus] = useState("NEW");
  const [sourceChannelId, setSourceChannelId] = useState("");

  const [nextFollowupAt, setNextFollowupAt] = useState("");
  const [lastContactNote, setLastContactNote] = useState("");
  const [lastContactAt, setLastContactAt] = useState<string | null>(null);

  const [resumeAt, setResumeAt] = useState("");
  const [closeReasonId, setCloseReasonId] = useState("");
  const [closeComment, setCloseComment] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

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

        const requestResult = await supabase
          .from("requests")
          .select(`
            id,
            client_id,
            project_id,
            title,
            initial_brief,
            responsible_user_id,
            status,
            source_channel_id,
            next_followup_at,
            last_contact_note,
            last_contact_at,
            resume_at,
            close_reason_id,
            close_comment,
            confirmed_at
          `)
          .eq("id", id)
          .single();

        if (requestResult.error || !requestResult.data) {
          throw new Error("No se pudo cargar la solicitud.");
        }

        const [
          clientResult,
          projectResult,
          profileResult,
          channelResult,
          reasonResult,
        ] = await Promise.all([
          supabase
            .from("clients")
            .select("id, name")
            .eq("status", "ACTIVE")
            .order("name"),

          supabase
            .from("projects")
            .select("id, name, client_id")
            .order("name"),

          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("status", "ACTIVE")
            .order("full_name"),

          supabase
            .from("request_source_channels")
            .select("id, name")
            .order("name"),

          supabase
            .from("request_close_reasons")
            .select("id, name")
            .order("name"),
        ]);

        if (
          clientResult.error ||
          projectResult.error ||
          profileResult.error ||
          channelResult.error ||
          reasonResult.error
        ) {
          throw new Error(
            "No se pudieron cargar los datos auxiliares."
          );
        }

        const requestData = requestResult.data;

        setClientId(requestData.client_id ?? "");
        setProjectId(requestData.project_id ?? "");
        setTitle(requestData.title ?? "");
        setInitialBrief(requestData.initial_brief ?? "");
        setResponsibleUserId(requestData.responsible_user_id ?? "");
        setStatus(requestData.status ?? "NEW");
        setOriginalStatus(requestData.status ?? "NEW");
        setSourceChannelId(requestData.source_channel_id ?? "");

        setNextFollowupAt(
          toLocalDateTimeInput(requestData.next_followup_at)
        );

        setLastContactNote(requestData.last_contact_note ?? "");
        setLastContactAt(requestData.last_contact_at ?? null);

        setResumeAt(
          toLocalDateTimeInput(requestData.resume_at)
        );

        setCloseReasonId(requestData.close_reason_id ?? "");
        setCloseComment(requestData.close_comment ?? "");
        setConfirmedAt(requestData.confirmed_at ?? null);

        setClients(clientResult.data ?? []);
        setProjects(projectResult.data ?? []);
        setProfiles(profileResult.data ?? []);
        setSourceChannels(channelResult.data ?? []);
        setCloseReasons(reasonResult.data ?? []);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la solicitud."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, router]);

  const filteredProjects = useMemo(() => {
    if (!clientId) return [];

    return projects.filter(
      (project) => project.client_id === clientId
    );
  }, [clientId, projects]);

  function handleClientChange(selectedClientId: string) {
    setClientId(selectedClientId);

    const selectedProjectStillBelongsToClient =
      projects.some(
        (project) =>
          project.id === projectId &&
          project.client_id === selectedClientId
      );

    if (!selectedProjectStillBelongsToClient) {
      setProjectId("");
    }
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving) return;

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
      setErrorMessage("Ingresá un título.");
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
        "Para Esperando cliente, definí el próximo seguimiento."
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

    try {
      const now = new Date().toISOString();

      let nextConfirmedAt = confirmedAt;

      if (
        status === "CONFIRMED" &&
        originalStatus !== "CONFIRMED" &&
        !confirmedAt
      ) {
        nextConfirmedAt = now;
      }

      const { error } = await supabase
        .from("requests")
        .update({
          client_id: clientId,
          project_id: projectId,
          title: title.trim(),
          initial_brief: initialBrief.trim(),
          responsible_user_id: responsibleUserId,
          status,
          source_channel_id: sourceChannelId || null,

          next_followup_at:
            status === "WAITING_CLIENT" && nextFollowupAt
              ? new Date(nextFollowupAt).toISOString()
              : null,

          last_contact_note:
            status === "WAITING_CLIENT"
              ? lastContactNote.trim() || null
              : null,

          last_contact_at:
            status === "WAITING_CLIENT" &&
            lastContactNote.trim()
              ? lastContactAt ?? now
              : null,

          resume_at:
            status === "POSTPONED" && resumeAt
              ? new Date(resumeAt).toISOString()
              : null,

          close_reason_id:
            status === "DID_NOT_ADVANCE" ||
            status === "CANCELLED"
              ? closeReasonId
              : null,

          close_comment:
            status === "DID_NOT_ADVANCE" ||
            status === "CANCELLED"
              ? closeComment.trim() || null
              : null,

          confirmed_at: nextConfirmedAt,
          updated_at: now,
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      router.replace(`/solicitudes/${id}`);
      router.refresh();
    } catch (error) {
      console.error("Error updating request:", error);

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
          Cargando solicitud...
        </p>
      </main>
    );
  }

  const showFollowup = status === "WAITING_CLIENT";
  const showResume = status === "POSTPONED";
  const showClose =
    status === "DID_NOT_ADVANCE" ||
    status === "CANCELLED";

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <Link
          href={`/solicitudes/${id}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a la solicitud
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <ClipboardList size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar solicitud
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Actualizá su definición, estado y seguimiento.
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
              La solicitud mantiene siempre su relación con un cliente y proyecto.
            </p>
          </div>

          <div className="space-y-7 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Cliente" required>
                <select
                  value={clientId}
                  onChange={(e) =>
                    handleClientChange(e.target.value)
                  }
                  className={inputClass}
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
              </Field>

              <Field label="Proyecto" required>
                <select
                  value={projectId}
                  disabled={!clientId}
                  onChange={(e) =>
                    setProjectId(e.target.value)
                  }
                  className={`${inputClass} disabled:opacity-40`}
                >
                  <option value="">
                    Seleccionar proyecto
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
              </Field>
            </div>

            <Field label="Título" required>
              <input
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Brief inicial" required>
              <textarea
                rows={7}
                value={initialBrief}
                onChange={(e) =>
                  setInitialBrief(e.target.value)
                }
                className={`${inputClass} resize-none leading-6`}
              />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Responsable" required>
                <select
                  value={responsibleUserId}
                  onChange={(e) =>
                    setResponsibleUserId(e.target.value)
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

              <Field label="Canal de ingreso">
                <select
                  value={sourceChannelId}
                  onChange={(e) =>
                    setSourceChannelId(e.target.value)
                  }
                  className={inputClass}
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
              </Field>
            </div>

            <Field label="Estado">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className={inputClass}
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

              {status === "CONFIRMED" &&
                originalStatus !== "CONFIRMED" && (
                  <p className="mt-2 text-xs text-emerald-500">
                    Al guardar, esta solicitud quedará confirmada y lista para generar Trabajos.
                  </p>
                )}
            </Field>

            {showFollowup && (
              <section className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <CalendarClock
                    size={18}
                    className="text-amber-400"
                  />

                  <div>
                    <p className="text-sm font-medium">
                      Seguimiento con cliente
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Definí cuándo corresponde volver a contactar.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Próximo seguimiento"
                    required
                  >
                    <input
                      type="datetime-local"
                      value={nextFollowupAt}
                      onChange={(e) =>
                        setNextFollowupAt(e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Último contacto / contexto">
                    <input
                      type="text"
                      value={lastContactNote}
                      onChange={(e) =>
                        setLastContactNote(e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>
            )}

            {showResume && (
              <section className="rounded-xl border border-orange-900/30 bg-orange-950/10 p-5">
                <Field
                  label="Retomar solicitud"
                  required
                >
                  <input
                    type="datetime-local"
                    value={resumeAt}
                    onChange={(e) =>
                      setResumeAt(e.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </section>
            )}

            {showClose && (
              <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Motivo" required>
                    <select
                      value={closeReasonId}
                      onChange={(e) =>
                        setCloseReasonId(e.target.value)
                      }
                      className={inputClass}
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
                  </Field>

                  <Field label="Comentario">
                    <input
                      type="text"
                      value={closeComment}
                      onChange={(e) =>
                        setCloseComment(e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
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

function toLocalDateTimeInput(
  value: string | null
) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}