import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  ExternalLink,
  FileVideo,
  History,
  MessageSquareText,
  Pencil,
  Send,
} from "lucide-react";

import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
    pieceId: string;
  }>;
};

type Version = {
  id: string;
  deliverable_id: string;
  version_number: number;
  review_url: string | null;
  created_by_user_id: string | null;
  sent_to_client_at: string | null;
  created_at: string;
};

type ClientSend = {
  id: string;
  deliverable_id: string;
  version_id: string | null;
  sent_by_user_id: string | null;
  delivery_method_id: string | null;
  sent_at: string;
  link: string | null;
  comment: string | null;
  created_at: string;
};

type FeedbackItem = {
  id: string;
  deliverable_id: string;
  version_id: string | null;
  origin: string | null;
  summary: string;
  status: string;
  logged_by_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
};

type DeliveryMethod = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  full_name: string;
};

export default async function DeliverableDetailPage({
  params,
}: PageProps) {
  const { id: jobId, pieceId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * PIEZA
   * =====================================
   */

  const {
    data: piece,
    error: pieceError,
  } = await supabase
    .from("deliverables")
    .select(`
      id,
      job_id,
      group_id,
      name,
      type_id,
      properties,
      status,
      deadline,
      responsible_user_id,
      editor_user_id,
      target_first_cut_at,
      actual_first_cut_at,
      current_version,
      final_url,
      urgent,
      queue_position,
      created_at,
      updated_at,

      deliverable_types:type_id (
        id,
        name
      ),

      responsible:responsible_user_id (
        id,
        full_name
      ),

      editor:editor_user_id (
        id,
        full_name
      ),

      deliverable_groups:group_id (
        id,
        name
      ),

      jobs:job_id (
        id,
        name,

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
    .eq("id", pieceId)
    .eq("job_id", jobId)
    .single();

  if (pieceError || !piece) {
    notFound();
  }

  /*
   * =====================================
   * HISTORIAL
   * =====================================
   */

  const [
    versionsResult,
    sendsResult,
    feedbackResult,
    methodsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("deliverable_versions")
      .select(`
        id,
        deliverable_id,
        version_number,
        review_url,
        created_by_user_id,
        sent_to_client_at,
        created_at
      `)
      .eq("deliverable_id", pieceId)
      .order("version_number", {
        ascending: false,
      }),

    supabase
      .from("client_sends")
      .select(`
        id,
        deliverable_id,
        version_id,
        sent_by_user_id,
        delivery_method_id,
        sent_at,
        link,
        comment,
        created_at
      `)
      .eq("deliverable_id", pieceId)
      .order("sent_at", {
        ascending: false,
      }),

    supabase
      .from("feedback_items")
      .select(`
        id,
        deliverable_id,
        version_id,
        origin,
        summary,
        status,
        logged_by_user_id,
        resolved_at,
        created_at
      `)
      .eq("deliverable_id", pieceId)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("delivery_methods")
      .select(`
        id,
        name
      `),

    supabase
      .from("profiles")
      .select(`
        id,
        full_name
      `),
  ]);

  const versions =
    (versionsResult.data ?? []) as Version[];

  const sends =
    (sendsResult.data ?? []) as ClientSend[];

  const feedbackItems =
    (feedbackResult.data ?? []) as FeedbackItem[];

  const methods =
    (methodsResult.data ?? []) as DeliveryMethod[];

  const profiles =
    (profilesResult.data ?? []) as Profile[];

  const historyError =
    versionsResult.error ||
    sendsResult.error ||
    feedbackResult.error ||
    methodsResult.error ||
    profilesResult.error;

  /*
   * =====================================
   * MAPAS AUXILIARES
   * =====================================
   */

  const methodMap =
    new Map(
      methods.map((method) => [
        method.id,
        method.name,
      ])
    );

  const profileMap =
    new Map(
      profiles.map((profile) => [
        profile.id,
        profile.full_name,
      ])
    );

  /*
   * =====================================
   * CONTEXTO
   * =====================================
   */

  const context =
    getPieceContext(piece);

  const typeName =
    relationValue(
      piece.deliverable_types,
      "name"
    ) ?? "Sin tipo";

  const responsibleName =
    relationValue(
      piece.responsible,
      "full_name"
    ) ?? "Sin responsable";

  const editorName =
    relationValue(
      piece.editor,
      "full_name"
    ) ?? "Sin editor";

  const groupName =
    relationValue(
      piece.deliverable_groups,
      "name"
    ) ?? "Sin grupo";

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1450px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8">

          <Link
            href={`/trabajos/${jobId}`}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Volver al Trabajo
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <div className="flex flex-wrap items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
                  <FileVideo size={20} />
                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="text-2xl font-semibold tracking-tight">
                      {piece.name}
                    </h1>

                    <StatusBadge
                      status={piece.status}
                    />

                    {piece.current_version &&
                      Number(piece.current_version) > 0 && (
                        <VersionBadge
                          version={piece.current_version}
                        />
                      )}

                    {piece.urgent && (
                      <span className="rounded-full border border-red-900/40 bg-red-950/30 px-2.5 py-1 text-[11px] font-medium text-red-400">
                        Urgente
                      </span>
                    )}

                  </div>

                  <p className="mt-1 text-sm text-zinc-500">
                    {context.clientName}
                    {" · "}
                    {context.projectName}
                    {" · "}
                    {context.jobName}
                  </p>

                </div>

              </div>

            </div>

            <Link
              href={`/trabajos/${jobId}/entregables/${pieceId}/editar`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-4 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Pencil size={15} />
              Editar pieza
            </Link>

          </div>

        </div>

        {/* =====================================
            RESUMEN
        ===================================== */}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <InfoCard
            label="Grupo"
            value={groupName}
          />

          <InfoCard
            label="Tipo"
            value={typeName}
          />

          <InfoCard
            label="Responsable"
            value={responsibleName}
          />

          <InfoCard
            label="Editor"
            value={editorName}
          />

          <InfoCard
            label="Deadline"
            value={
              piece.deadline
                ? formatDate(piece.deadline)
                : "Sin deadline"
            }
          />

          <InfoCard
            label="Primer corte objetivo"
            value={
              piece.target_first_cut_at
                ? formatDateTime(
                    piece.target_first_cut_at
                  )
                : "Sin definir"
            }
          />

          <InfoCard
            label="Primer corte real"
            value={
              piece.actual_first_cut_at
                ? formatDateTime(
                    piece.actual_first_cut_at
                  )
                : "Todavía no enviado"
            }
          />

          <InfoCard
            label="Versión actual"
            value={
              piece.current_version
                ? `V${piece.current_version}`
                : "Sin versión enviada"
            }
          />

        </section>

        {/* =====================================
            PROPIEDADES / FINAL
        ===================================== */}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Propiedades técnicas
              </h2>
            </div>

            <div className="p-6">

              {piece.properties &&
              typeof piece.properties === "object" &&
              Object.keys(piece.properties).length > 0 ? (

                <div className="space-y-3">

                  {Object.entries(
                    piece.properties
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-5 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-xs text-zinc-600">
                        {key}
                      </span>

                      <span className="text-right text-xs text-zinc-300">
                        {String(value)}
                      </span>
                    </div>
                  ))}

                </div>

              ) : (

                <p className="text-sm text-zinc-700">
                  Sin propiedades técnicas cargadas.
                </p>

              )}

            </div>

          </section>

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Archivo final
              </h2>
            </div>

            <div className="p-6">

              {piece.final_url ? (

                <a
                  href={piece.final_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#45B8E8] transition hover:text-white"
                >
                  <ExternalLink size={15} />
                  Abrir archivo final
                </a>

              ) : (

                <p className="text-sm text-zinc-700">
                  Todavía no se cargó un archivo final.
                </p>

              )}

            </div>

          </section>

        </div>

        {/* =====================================
            HISTORIAL VERSIONES
        ===================================== */}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-3">

              <History
                size={18}
                className="text-[#45B8E8]"
              />

              <div>

                <h2 className="text-sm font-semibold">
                  Historial de versiones
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Envíos al cliente, devoluciones y correcciones de esta pieza.
                </p>

              </div>

            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
              {versions.length}
            </span>

          </div>

          {historyError && (
            <div className="border-b border-red-900/20 bg-red-950/10 px-6 py-4 text-xs text-red-400">
              Hubo un problema al cargar parte del historial.
            </div>
          )}

          {versions.length === 0 ? (

            <div className="px-6 py-14 text-center">

              <History
                size={24}
                className="mx-auto text-zinc-800"
              />

              <p className="mt-4 text-sm text-zinc-600">
                Todavía no hay versiones enviadas al cliente.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-white/5">

              {versions.map((version) => {

                const versionSends =
                  sends.filter(
                    (send) =>
                      send.version_id ===
                      version.id
                  );

                const versionFeedback =
                  feedbackItems.filter(
                    (feedback) =>
                      feedback.version_id ===
                      version.id
                  );

                const creatorName =
                  version.created_by_user_id
                    ? profileMap.get(
                        version.created_by_user_id
                      )
                    : undefined;

                return (
                  <div
                    key={version.id}
                    className="p-6"
                  >

                    {/* VERSION HEADER */}

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="inline-flex rounded-lg border border-[#20A4DD]/25 bg-[#20A4DD]/10 px-3 py-1.5 text-sm font-semibold text-[#45B8E8]">
                            V{version.version_number}
                          </span>

                          {Number(
                            piece.current_version
                          ) ===
                            Number(
                              version.version_number
                            ) && (
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-zinc-500">
                              Versión actual
                            </span>
                          )}

                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">

                          {version.sent_to_client_at && (
                            <span className="flex items-center gap-1.5">
                              <CalendarClock size={13} />
                              {formatDateTime(
                                version.sent_to_client_at
                              )}
                            </span>
                          )}

                          {creatorName && (
                            <span className="flex items-center gap-1.5">
                              <CircleUserRound size={13} />
                              {creatorName}
                            </span>
                          )}

                        </div>

                      </div>

                      {version.review_url && (
                        <a
                          href={version.review_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#45B8E8] transition hover:bg-white/5 hover:text-white"
                        >
                          <ExternalLink size={13} />
                          Abrir versión
                        </a>
                      )}

                    </div>

                    {/* ENVÍOS */}

                    <div className="mt-6">

                      <div className="mb-3 flex items-center gap-2">

                        <Send
                          size={14}
                          className="text-zinc-600"
                        />

                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                          Envío al cliente
                        </p>

                      </div>

                      {versionSends.length === 0 ? (

                        <p className="text-xs text-zinc-700">
                          Sin envío registrado.
                        </p>

                      ) : (

                        <div className="space-y-2">

                          {versionSends.map((send) => {

                            const methodName =
                              send.delivery_method_id
                                ? methodMap.get(
                                    send.delivery_method_id
                                  )
                                : undefined;

                            const senderName =
                              send.sent_by_user_id
                                ? profileMap.get(
                                    send.sent_by_user_id
                                  )
                                : undefined;

                            return (
                              <div
                                key={send.id}
                                className="rounded-xl border border-white/[0.07] bg-[#07090B] p-4"
                              >

                                <div className="flex flex-wrap items-center gap-3">

                                  <span className="text-xs font-medium text-zinc-300">
                                    {methodName ??
                                      "Método no registrado"}
                                  </span>

                                  <span className="text-[11px] text-zinc-700">
                                    {formatDateTime(
                                      send.sent_at
                                    )}
                                  </span>

                                  {senderName && (
                                    <span className="text-[11px] text-zinc-700">
                                      por {senderName}
                                    </span>
                                  )}

                                </div>

                                {send.comment && (
                                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                                    {send.comment}
                                  </p>
                                )}

                                {send.link && (
                                  <a
                                    href={send.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#45B8E8] transition hover:text-white"
                                  >
                                    <ExternalLink size={12} />
                                    Abrir envío
                                  </a>
                                )}

                              </div>
                            );
                          })}

                        </div>

                      )}

                    </div>

                    {/* FEEDBACK */}

                    <div className="mt-6">

                      <div className="mb-3 flex items-center gap-2">

                        <MessageSquareText
                          size={14}
                          className="text-zinc-600"
                        />

                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                          Feedback
                        </p>

                      </div>

                      {versionFeedback.length === 0 ? (

                        <p className="text-xs text-zinc-700">
                          El cliente no dejó correcciones registradas para esta versión.
                        </p>

                      ) : (

                        <div className="space-y-3">

                          {versionFeedback.map(
                            (feedback) => {

                              const loggedBy =
                                feedback.logged_by_user_id
                                  ? profileMap.get(
                                      feedback.logged_by_user_id
                                    )
                                  : undefined;

                              const resolved =
                                feedback.status ===
                                "RESOLVED";

                              return (
                                <div
                                  key={
                                    feedback.id
                                  }
                                  className={`rounded-xl border p-4 ${
                                    resolved
                                      ? "border-emerald-900/25 bg-emerald-950/10"
                                      : "border-red-900/30 bg-red-950/10"
                                  }`}
                                >

                                  <div className="flex flex-wrap items-center justify-between gap-3">

                                    <div className="flex items-center gap-2">

                                      {resolved ? (
                                        <CheckCircle2
                                          size={14}
                                          className="text-emerald-400"
                                        />
                                      ) : (
                                        <Clock3
                                          size={14}
                                          className="text-red-400"
                                        />
                                      )}

                                      <span
                                        className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                          resolved
                                            ? "text-emerald-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {resolved
                                          ? "Corrección resuelta"
                                          : "Corrección pendiente"}
                                      </span>

                                    </div>

                                    <span className="text-[10px] text-zinc-700">
                                      {formatDateTime(
                                        feedback.created_at
                                      )}
                                    </span>

                                  </div>

                                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                    {feedback.summary}
                                  </p>

                                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-700">

                                    {feedback.origin && (
                                      <span>
                                        Origen:{" "}
                                        {feedback.origin ===
                                        "CLIENT"
                                          ? "Cliente"
                                          : feedback.origin}
                                      </span>
                                    )}

                                    {loggedBy && (
                                      <span>
                                        Registrado por:{" "}
                                        {loggedBy}
                                      </span>
                                    )}

                                    {feedback.resolved_at && (
                                      <span>
                                        Resuelto:{" "}
                                        {formatDateTime(
                                          feedback.resolved_at
                                        )}
                                      </span>
                                    )}

                                  </div>

                                </div>
                              );
                            }
                          )}

                        </div>

                      )}

                    </div>

                  </div>
                );
              })}

            </div>

          )}

        </section>

        {/* =====================================
            FEEDBACK SIN VERSIÓN
        ===================================== */}

        {feedbackItems.some(
          (feedback) =>
            !feedback.version_id
        ) && (
          <section className="mt-6 rounded-xl border border-amber-900/20 bg-amber-950/10 p-6">

            <div className="flex items-center gap-2">

              <MessageSquareText
                size={16}
                className="text-amber-400"
              />

              <h2 className="text-sm font-semibold text-amber-300">
                Feedback sin versión asociada
              </h2>

            </div>

            <div className="mt-4 space-y-3">

              {feedbackItems
                .filter(
                  (feedback) =>
                    !feedback.version_id
                )
                .map(
                  (feedback) => (
                    <div
                      key={feedback.id}
                      className="rounded-lg border border-white/[0.06] bg-black/10 p-4"
                    >
                      <p className="text-sm text-zinc-300">
                        {feedback.summary}
                      </p>
                    </div>
                  )
                )}

            </div>

          </section>
        )}

      </div>
    </main>
  );
}

/*
 * =====================================
 * CARDS
 * =====================================
 */

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">

      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </p>

      <p className="mt-2 text-sm text-zinc-300">
        {value}
      </p>

    </div>
  );
}

/*
 * =====================================
 * VERSION
 * =====================================
 */

function VersionBadge({
  version,
}: {
  version: number;
}) {
  return (
    <span className="inline-flex rounded-full border border-[#20A4DD]/25 bg-[#20A4DD]/10 px-2.5 py-1 text-[10px] font-semibold text-[#45B8E8]">
      V{version}
    </span>
  );
}

/*
 * =====================================
 * STATUS
 * =====================================
 */

function StatusBadge({
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
    DEFINED: {
      label: "Definido",
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-400",
    },

    PENDING_MATERIAL: {
      label: "Pendiente material",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    READY_POST: {
      label: "Listo para post",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    EDITING: {
      label: "En edición",
      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    COORDINATOR_REVIEW: {
      label: "Revisión coordinador",
      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    INTERNAL_REVIEW: {
      label: "Revisión interna",
      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    CLIENT_REVIEW: {
      label: "Revisión cliente",
      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },

    CORRECTIONS: {
      label: "Correcciones",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    APPROVED: {
      label: "Aprobado",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    DELIVERED: {
      label: "Entregado",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${current.className}`}
    >
      {current.label}
    </span>
  );
}

/*
 * =====================================
 * CONTEXTO
 * =====================================
 */

function getPieceContext(
  piece: any
) {
  const jobName =
    relationValue(
      piece.jobs,
      "name"
    ) ?? "Sin Trabajo";

  const jobObject =
    Array.isArray(piece.jobs)
      ? piece.jobs[0]
      : piece.jobs;

  const projectRelation =
    jobObject &&
    typeof jobObject === "object"
      ? (
          jobObject as Record<
            string,
            unknown
          >
        ).projects
      : null;

  const projectName =
    relationValue(
      projectRelation,
      "name"
    ) ?? "Sin proyecto";

  const projectObject =
    Array.isArray(projectRelation)
      ? projectRelation[0]
      : projectRelation;

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

  const clientName =
    relationValue(
      clientRelation,
      "name"
    ) ?? "Sin cliente";

  return {
    jobName,
    projectName,
    clientName,
  };
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

  if (Array.isArray(relation)) {
    const first =
      relation[0] as
        | Record<string, unknown>
        | undefined;

    const value =
      first?.[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  if (
    typeof relation === "object"
  ) {
    const value = (
      relation as Record<
        string,
        unknown
      >
    )[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  return undefined;
}

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}