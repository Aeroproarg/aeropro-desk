import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FolderKanban,
  MessageSquareText,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";

type RequestPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RequestDetailPage({
  params,
}: RequestPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: request, error } = await supabase
    .from("requests")
    .select(`
      id,
      title,
      initial_brief,
      status,
      created_at,
      next_followup_at,
      last_contact_note,
      last_contact_at,
      resume_at,
      close_comment,
      confirmed_at,
      client_id,
      project_id,
      responsible_user_id,
      source_channel_id,
      close_reason_id,

      clients:client_id (
        name
      ),

      projects:project_id (
        name
      ),

      profiles:responsible_user_id (
        full_name
      ),

      request_source_channels:source_channel_id (
        name
      ),

      request_close_reasons:close_reason_id (
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !request) {
    notFound();
  }

  const { data: generatedJobs } = await supabase
    .from("jobs")
    .select(`
      id,
      name,
      status,
      created_at,

      job_categories:category_id (
        name
      ),

      profiles:responsible_user_id (
        full_name
      )
    `)
    .eq("source_request_id", id)
    .order("created_at", { ascending: true });

  const clientName = relationValue(
    request.clients,
    "name"
  );

  const projectName = relationValue(
    request.projects,
    "name"
  );

  const responsibleName = relationValue(
    request.profiles,
    "full_name"
  );

  const channelName = relationValue(
    request.request_source_channels,
    "name"
  );

  const closeReasonName = relationValue(
    request.request_close_reasons,
    "name"
  );

  const jobs = generatedJobs ?? [];

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
        <Link
          href="/solicitudes"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Solicitudes
        </Link>

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <ClipboardList size={23} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {request.title}
                </h1>

                <RequestStatusBadge
                  status={request.status}
                />
              </div>

              <p className="text-sm text-zinc-500">
                {clientName ?? "Sin cliente"} ·{" "}
                {projectName ?? "Sin proyecto"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {request.status === "CONFIRMED" && (
              <Link
                href={`/solicitudes/${request.id}/generar-trabajos`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
              >
                <Plus size={16} />
                Generar Trabajos
              </Link>
            )}

            <Link
              href={`/solicitudes/${request.id}/editar`}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <Pencil size={16} />
              Editar solicitud
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Información general
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Datos principales de la solicitud.
              </p>
            </div>

            <div className="divide-y divide-white/5">
              <InfoRow
                label="Cliente"
                value={clientName ?? "Sin cliente"}
              />

              <InfoRow
                label="Proyecto"
                value={projectName ?? "Sin proyecto"}
              />

              <InfoRow
                label="Responsable"
                value={
                  responsibleName ?? "Sin responsable"
                }
              />

              <InfoRow
                label="Canal de ingreso"
                value={channelName ?? "Sin especificar"}
              />

              <InfoRow
                label="Estado"
                value={formatRequestStatus(
                  request.status
                )}
              />

              <InfoRow
                label="Creada"
                value={formatDate(
                  request.created_at
                )}
              />
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Responsable
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Seguimiento principal de esta solicitud.
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#20A4DD]/10 text-[#45B8E8]">
                  <UserRound size={18} />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {responsibleName ??
                      "Sin responsable"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Responsable de seguimiento
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Brief original
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Pedido inicial tal como fue registrado.
            </p>
          </div>

          <div className="p-6">
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
              {request.initial_brief}
            </p>
          </div>
        </section>

        {(request.status === "WAITING_CLIENT" ||
          request.next_followup_at ||
          request.last_contact_note) && (
          <section className="mt-6 overflow-hidden rounded-xl border border-amber-900/30 bg-amber-950/10">
            <div className="border-b border-amber-900/20 px-6 py-5">
              <div className="flex items-center gap-3">
                <CalendarClock
                  size={18}
                  className="text-amber-400"
                />

                <div>
                  <h2 className="text-sm font-semibold">
                    Seguimiento
                  </h2>

                  <p className="mt-1 text-xs text-zinc-600">
                    Próximo contacto y contexto reciente.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-amber-900/10">
              <InfoRow
                label="Próximo seguimiento"
                value={
                  request.next_followup_at
                    ? formatDateTime(
                        request.next_followup_at
                      )
                    : "Sin fecha"
                }
              />

              <InfoRow
                label="Último contacto"
                value={
                  request.last_contact_at
                    ? formatDateTime(
                        request.last_contact_at
                      )
                    : "Sin registro"
                }
              />

              <InfoRow
                label="Contexto"
                value={
                  request.last_contact_note ??
                  "Sin comentario"
                }
              />
            </div>
          </section>
        )}

        {(request.status === "POSTPONED" ||
          request.resume_at) && (
          <section className="mt-6 overflow-hidden rounded-xl border border-orange-900/30 bg-orange-950/10">
            <div className="border-b border-orange-900/20 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Solicitud postergada
              </h2>
            </div>

            <div className="p-6">
              <p className="text-sm text-zinc-600">
                Retomar:
              </p>

              <p className="mt-2 text-sm font-medium text-orange-300">
                {request.resume_at
                  ? formatDateTime(
                      request.resume_at
                    )
                  : "Sin fecha definida"}
              </p>
            </div>
          </section>
        )}

        {(request.status ===
          "DID_NOT_ADVANCE" ||
          request.status === "CANCELLED") && (
          <section className="mt-6 overflow-hidden rounded-xl border border-red-900/30 bg-red-950/10">
            <div className="border-b border-red-900/20 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Cierre de solicitud
              </h2>
            </div>

            <div className="divide-y divide-red-900/10">
              <InfoRow
                label="Motivo"
                value={
                  closeReasonName ?? "Sin motivo"
                }
              />

              <InfoRow
                label="Comentario"
                value={
                  request.close_comment ??
                  "Sin comentario"
                }
              />
            </div>
          </section>
        )}

        {request.status === "CONFIRMED" && (
          <section className="mt-6 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-950/50 text-emerald-400">
                <FolderKanban size={18} />
              </div>

              <div>
                <p className="text-sm font-medium text-emerald-300">
                  Solicitud confirmada
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Esta solicitud puede generar uno o
                  varios Trabajos.
                </p>

                {request.confirmed_at && (
                  <p className="mt-3 text-xs text-zinc-600">
                    Confirmada el{" "}
                    {formatDateTime(
                      request.confirmed_at
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Trabajos generados
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Trabajos creados a partir de esta solicitud.
              </p>
            </div>

            {request.status === "CONFIRMED" && (
              <Link
                href={`/solicitudes/${request.id}/generar-trabajos`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                <Plus size={15} />
                Agregar Trabajo
              </Link>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                <BriefcaseBusiness size={18} />
              </div>

              <p className="text-sm font-medium text-zinc-300">
                Todavía no hay Trabajos
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Los Trabajos generados desde esta
                solicitud aparecerán acá.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {jobs.map((job: any) => {
                const categoryName = relationValue(
                  job.job_categories,
                  "name"
                );

                const jobResponsible = relationValue(
                  job.profiles,
                  "full_name"
                );

                return (
                  <div
                    key={job.id}
                    className="grid gap-4 px-6 py-5 md:grid-cols-[1.4fr_1fr_1fr_0.8fr]"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {job.name}
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        Creado{" "}
                        {formatDate(
                          job.created_at
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-zinc-600">
                        Categoría
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        {categoryName ??
                          "Sin categoría"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-zinc-600">
                        Responsable
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        {jobResponsible ??
                          "Sin responsable"}
                      </p>
                    </div>

                    <div>
                      <JobStatusBadge
                        status={job.status}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-dashed border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-600">
              <MessageSquareText size={18} />
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-300">
                Historial de seguimientos
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Más adelante vamos a registrar acá cada
                contacto realizado y sus próximos
                seguimientos.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function relationValue(
  relation: unknown,
  property: string
): string | undefined {
  if (!relation) return undefined;

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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 px-6 py-5 sm:grid-cols-[180px_1fr]">
      <p className="text-sm text-zinc-600">
        {label}
      </p>

      <p className="text-sm text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function RequestStatusBadge({
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
    NEW: {
      label: "Nueva",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    IN_DEFINITION: {
      label: "En definición",
      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    WAITING_CLIENT: {
      label: "Esperando cliente",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    CONFIRMED: {
      label: "Confirmada",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    POSTPONED: {
      label: "Postergada",
      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },

    DID_NOT_ADVANCE: {
      label: "No avanzó",
      className:
        "border-zinc-800 bg-zinc-900 text-zinc-500",
    },

    CANCELLED: {
      label: "Cancelada",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
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

function JobStatusBadge({
  status,
}: {
  status: string;
}) {
  const labels: Record<string, string> = {
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
    <span className="inline-flex rounded-full border border-[#20A4DD]/20 bg-[#20A4DD]/10 px-2.5 py-1 text-xs text-[#45B8E8]">
      {labels[status] ?? status}
    </span>
  );
}

function formatRequestStatus(
  status: string
) {
  const statuses: Record<string, string> = {
    NEW: "Nueva solicitud",
    IN_DEFINITION: "En definición",
    WAITING_CLIENT: "Esperando cliente",
    CONFIRMED: "Confirmada",
    POSTPONED: "Postergada",
    DID_NOT_ADVANCE: "No avanzó",
    CANCELLED: "Cancelada",
  };

  return statuses[status] ?? status;
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}