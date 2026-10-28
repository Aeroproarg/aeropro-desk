import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Film,
  History,
  ListOrdered,
  ListTodo,
  MessageSquareText,
  Search,
  Send,
  UserRoundPlus,
} from "lucide-react";

import AssignEditorForm from "./assign-editor-form";
import QueuePositionControls from "./queue-position-controls";
import AdvanceEditingStatus from "./advance-editing-status";
import ReviewActions from "./review-actions";

type Profile = {
  id: string;
  full_name: string;
};

type LastSend = {
  id: string;
  deliverable_id: string;
  version_id: string;
  sent_at: string;
  link: string | null;
  comment: string | null;

  delivery_methods:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type PendingFeedback = {
  id: string;
  deliverable_id: string;
  version_id: string | null;
  summary: string;
  status: string;
  created_at: string;
};

export default async function EditingPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * DATOS
   * =====================================
   */

  const [
    piecesResult,
    profilesResult,
    sendsResult,
    feedbackResult,
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select(`
        id,
        job_id,
        group_id,
        name,
        status,
        deadline,
        editor_user_id,
        responsible_user_id,
        target_first_cut_at,
        actual_first_cut_at,
        current_version,
        urgent,
        queue_position,
        created_at,

        editor:editor_user_id (
          id,
          full_name
        ),

        responsible:responsible_user_id (
          id,
          full_name
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
        ),

        deliverable_groups:group_id (
          id,
          name
        )
      `)
      .not(
        "status",
        "in",
        '("DELIVERED","OUT_OF_SCOPE")'
      )
      .order(
        "urgent",
        {
          ascending: false,
        }
      )
      .order(
        "deadline",
        {
          ascending: true,
          nullsFirst: false,
        }
      ),

    supabase
      .from("profiles")
      .select(`
        id,
        full_name
      `)
      .eq(
        "status",
        "ACTIVE"
      )
      .order(
        "full_name",
        {
          ascending: true,
        }
      ),

    supabase
      .from("client_sends")
      .select(`
        id,
        deliverable_id,
        version_id,
        sent_at,
        link,
        comment,

        delivery_methods:delivery_method_id (
          id,
          name
        )
      `)
      .order(
        "sent_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("feedback_items")
      .select(`
        id,
        deliverable_id,
        version_id,
        summary,
        status,
        created_at
      `)
      .eq(
        "status",
        "PENDING"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),
  ]);

  const error =
    piecesResult.error ||
    profilesResult.error ||
    sendsResult.error ||
    feedbackResult.error;

  const allPieces =
    piecesResult.data ?? [];

  const profiles =
    (profilesResult.data ??
      []) as Profile[];

  const sends =
    (sendsResult.data ??
      []) as unknown as LastSend[];

  const pendingFeedback =
    (feedbackResult.data ??
      []) as PendingFeedback[];

  /*
   * =====================================
   * ÚLTIMO ENVÍO POR PIEZA
   * =====================================
   */

  const lastSendByPiece =
    new Map<string, LastSend>();

  for (const send of sends) {
    if (
      !lastSendByPiece.has(
        send.deliverable_id
      )
    ) {
      lastSendByPiece.set(
        send.deliverable_id,
        send
      );
    }
  }

  /*
   * =====================================
   * ÚLTIMO FEEDBACK PENDIENTE
   * POR PIEZA
   * =====================================
   */

  const pendingFeedbackByPiece =
    new Map<
      string,
      PendingFeedback
    >();

  for (
    const feedback of
    pendingFeedback
  ) {
    if (
      !pendingFeedbackByPiece.has(
        feedback.deliverable_id
      )
    ) {
      pendingFeedbackByPiece.set(
        feedback.deliverable_id,
        feedback
      );
    }
  }

  /*
   * =====================================
   * CLASIFICACIONES
   * =====================================
   */

  const readyPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
          "READY_POST"
    );

  const editingPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
        "EDITING"
    );

  const reviewPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
          "COORDINATOR_REVIEW" ||
        piece.status ===
          "INTERNAL_REVIEW"
    );

  const clientPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
          "CLIENT_REVIEW" ||
        piece.status ===
          "CORRECTIONS"
    );

  const waitingPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
          "DEFINED" ||
        piece.status ===
          "PENDING_MATERIAL"
    );

  const approvedPieces =
    allPieces.filter(
      (piece) =>
        piece.status ===
        "APPROVED"
    );

  const activeQueuePieces =
    allPieces.filter(
      (piece) =>
        piece.editor_user_id &&
        (
          piece.status ===
            "EDITING" ||
          piece.status ===
            "CORRECTIONS"
        )
    );

  /*
   * =====================================
   * MÉTRICAS
   * =====================================
   */

  const urgentCount =
    allPieces.filter(
      (piece) =>
        piece.urgent
    ).length;

  const overdueCount =
    allPieces.filter(
      (piece) =>
        piece.deadline &&
        new Date(
          piece.deadline
        ) <
          new Date() &&
        piece.status !==
          "APPROVED"
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
                <Film
                  size={21}
                />
              </div>

              <div>

                <h1 className="text-2xl font-semibold tracking-tight">
                  Edición
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Cola de postproducción, asignaciones, revisiones y entrega.
                </p>

              </div>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <Link
              href="/edicion/entregados"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <History
                size={16}
              />

              Ver entregados
            </Link>

            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500">

              <Search
                size={17}
              />

              Buscar pieza...

            </div>

          </div>

        </div>

        {/* =====================================
            MÉTRICAS
        ===================================== */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">

          <MetricCard
            label="Listas para edición"
            value={
              readyPieces.length
            }
            icon={
              <UserRoundPlus
                size={17}
              />
            }
          />

          <MetricCard
            label="En edición"
            value={
              editingPieces.length
            }
            icon={
              <Film
                size={17}
              />
            }
          />

          <MetricCard
            label="En revisión"
            value={
              reviewPieces.length
            }
            icon={
              <Clock3
                size={17}
              />
            }
          />

          <MetricCard
            label="Cliente / correcciones"
            value={
              clientPieces.length
            }
            icon={
              <ListTodo
                size={17}
              />
            }
          />

          <MetricCard
            label="Urgentes"
            value={
              urgentCount
            }
            icon={
              <AlertTriangle
                size={17}
              />
            }
            danger={
              urgentCount > 0
            }
          />

          <MetricCard
            label="Vencidas"
            value={
              overdueCount
            }
            icon={
              <CalendarClock
                size={17}
              />
            }
            danger={
              overdueCount > 0
            }
          />

        </section>

        {/* =====================================
            ERROR
        ===================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar correctamente los datos de Edición.
          </div>
        )}

        {/* =====================================
            COLA POR EDITOR
        ===================================== */}

        <EditingSection
          title="Cola por editor"
          description="Orden de prioridad operativo de cada editor."
          count={
            activeQueuePieces.length
          }
          icon={
            <ListOrdered
              size={18}
            />
          }
        >

          <EditorQueues
            pieces={
              activeQueuePieces
            }
            profiles={
              profiles
            }
            pendingFeedbackByPiece={
              pendingFeedbackByPiece
            }
          />

        </EditingSection>

        {/* =====================================
            LISTAS PARA ASIGNAR
        ===================================== */}

        <EditingSection
          title="Listas para edición"
          description="El material confirmado por carpeta habilita las piezas automáticamente. Asignar y comenzar edición es un paso separado."
          count={
            readyPieces.length
          }
          icon={
            <UserRoundPlus
              size={18}
            />
          }
        >

          <AssignmentTable
            pieces={
              readyPieces
            }
            profiles={
              profiles
            }
          />

        </EditingSection>

        {/* =====================================
            REVISIONES
        ===================================== */}

        <EditingSection
          title="Revisiones"
          description="Piezas esperando revisión de coordinación o revisión interna."
          count={
            reviewPieces.length
          }
          icon={
            <Clock3
              size={18}
            />
          }
        >

          <ReviewTable
            pieces={
              reviewPieces
            }
            lastSendByPiece={
              lastSendByPiece
            }
            showLastSend={
              false
            }
          />

        </EditingSection>

        {/* =====================================
            CLIENTE / CORRECCIONES
        ===================================== */}

        <EditingSection
          title="Cliente y correcciones"
          description="Piezas enviadas al cliente o actualmente en corrección."
          count={
            clientPieces.length
          }
          icon={
            <ListTodo
              size={18}
            />
          }
        >

          <ReviewTable
            pieces={
              clientPieces
            }
            lastSendByPiece={
              lastSendByPiece
            }
            showLastSend
          />

        </EditingSection>

        {/* =====================================
            APROBADAS
        ===================================== */}

        <EditingSection
          title="Aprobadas pendientes de entrega"
          description="Piezas aprobadas que todavía no fueron marcadas como entregadas."
          count={
            approvedPieces.length
          }
          icon={
            <CheckCircle2
              size={18}
            />
          }
        >

          <ReviewTable
            pieces={
              approvedPieces
            }
            lastSendByPiece={
              lastSendByPiece
            }
            showLastSend
          />

        </EditingSection>

        {/* =====================================
            NO LISTAS
        ===================================== */}

        <EditingSection
          title="Todavía no listas para post"
          description="Piezas definidas o pendientes de material."
          count={
            waitingPieces.length
          }
          icon={
            <Clock3
              size={18}
            />
          }
          secondary
        >

          <PieceTable
            pieces={
              waitingPieces
            }
          />

        </EditingSection>

      </div>

    </main>
  );
}

/*
 * =====================================
 * COLAS POR EDITOR
 * =====================================
 */

function EditorQueues({
  pieces,
  profiles,
  pendingFeedbackByPiece,
}: {
  pieces: any[];
  profiles: Profile[];

  pendingFeedbackByPiece: Map<
    string,
    PendingFeedback
  >;
}) {
  if (
    pieces.length ===
    0
  ) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-700">
        Todavía no hay piezas activas en cola.
      </div>
    );
  }

  const editorsWithPieces =
    profiles
      .map(
        (profile) => {
          const editorPieces =
            pieces
              .filter(
                (piece) =>
                  piece.editor_user_id ===
                  profile.id
              )
              .sort(
                (
                  a,
                  b
                ) => {
                  const aPosition =
                    a.queue_position ??
                    999999;

                  const bPosition =
                    b.queue_position ??
                    999999;

                  if (
                    aPosition !==
                    bPosition
                  ) {
                    return (
                      aPosition -
                      bPosition
                    );
                  }

                  if (
                    a.urgent &&
                    !b.urgent
                  ) {
                    return -1;
                  }

                  if (
                    !a.urgent &&
                    b.urgent
                  ) {
                    return 1;
                  }

                  return 0;
                }
              );

          return {
            profile,
            pieces:
              editorPieces,
          };
        }
      )
      .filter(
        (item) =>
          item.pieces
            .length >
          0
      );

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-2">

      {editorsWithPieces.map(
        ({
          profile,
          pieces:
            editorPieces,
        }) => (
          <div
            key={
              profile.id
            }
            className="overflow-hidden rounded-xl border border-white/10 bg-[#07090B]"
          >

            {/* EDITOR */}

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#20A4DD]/10 text-[#45B8E8]">
                  <CircleUserRound
                    size={17}
                  />
                </div>

                <div>

                  <p className="text-sm font-medium text-zinc-200">
                    {
                      profile.full_name
                    }
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-700">
                    {
                      editorPieces.length
                    }{" "}
                    {editorPieces.length ===
                    1
                      ? "pieza activa"
                      : "piezas activas"}
                  </p>

                </div>

              </div>

            </div>

            {/* PIEZAS */}

            <div className="divide-y divide-white/5">

              {editorPieces.map(
                (
                  piece,
                  index
                ) => {
                  const context =
                    getPieceContext(
                      piece
                    );

                  const groupName =
                    relationValue(
                      piece.deliverable_groups,
                      "name"
                    );

                  const firstCutOverdue =
                    piece.target_first_cut_at &&
                    !piece.actual_first_cut_at &&
                    new Date(
                      piece.target_first_cut_at
                    ) <
                      new Date();

                  const deadlineOverdue =
                    isOverdue(
                      piece.deadline
                    );

                  const feedback =
                    pendingFeedbackByPiece.get(
                      piece.id
                    );

                  return (
                    <div
                      key={
                        piece.id
                      }
                      className="p-5"
                    >

                      <div className="flex items-start gap-4">

                        {/* POSICIÓN */}

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-sm font-semibold text-[#45B8E8]">
                          #
                          {index +
                            1}
                        </div>

                        {/* CONTENIDO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <Link
                              href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                              className="truncate text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                            >
                              {
                                piece.name
                              }
                            </Link>

                            {piece.urgent && (
                              <span className="rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
                                Urgente
                              </span>
                            )}

                            <StatusBadge
                              status={
                                piece.status
                              }
                            />

                            {piece.current_version &&
                              Number(
                                piece.current_version
                              ) > 0 && (
                                <VersionBadge
                                  version={
                                    piece.current_version
                                  }
                                />
                              )}

                          </div>

                          <p className="mt-1 truncate text-xs text-zinc-700">
                            {
                              context.clientName
                            }
                            {" · "}
                            {
                              context.projectName
                            }
                          </p>

                          <p className="mt-1 truncate text-[11px] text-zinc-700">
                            {groupName ??
                              "Sin grupo"}
                            {" · "}
                            {
                              context.jobName
                            }
                          </p>

                          {/* =====================================
                              CORRECCIÓN PENDIENTE
                          ===================================== */}

                          {piece.status ===
                            "CORRECTIONS" &&
                            feedback && (
                              <div className="mt-4 rounded-xl border border-red-900/30 bg-red-950/10 p-3">

                                <div className="flex items-center gap-2">

                                  <MessageSquareText
                                    size={14}
                                    className="shrink-0 text-red-400"
                                  />

                                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-red-400">
                                    Corrección pendiente
                                  </p>

                                  {piece.current_version &&
                                    Number(
                                      piece.current_version
                                    ) > 0 && (
                                      <span className="text-[10px] text-zinc-600">
                                        sobre V
                                        {
                                          piece.current_version
                                        }
                                      </span>
                                    )}

                                </div>

                                <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                                  {
                                    feedback.summary
                                  }
                                </p>

                              </div>
                            )}

                          {/* =====================================
                              FECHAS
                          ===================================== */}

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">

                            <div>

                              <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                                Primer corte
                              </p>

                              <p
                                className={`mt-1 text-xs ${
                                  firstCutOverdue
                                    ? "text-red-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                {piece.target_first_cut_at
                                  ? formatDateTime(
                                      piece.target_first_cut_at
                                    )
                                  : "Sin definir"}
                              </p>

                            </div>

                            <div>

                              <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                                Deadline
                              </p>

                              <p
                                className={`mt-1 text-xs ${
                                  deadlineOverdue
                                    ? "text-red-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                {piece.deadline
                                  ? formatDate(
                                      piece.deadline
                                    )
                                  : "Sin deadline"}
                              </p>

                            </div>

                          </div>

                        </div>

                        {/* CONTROLES */}

                        <div className="flex shrink-0 flex-col items-end gap-2">

                          <QueuePositionControls
                            pieceId={
                              piece.id
                            }
                            editorId={
                              profile.id
                            }
                            queuePosition={
                              piece.queue_position
                            }
                          />

                          <AdvanceEditingStatus
                            pieceId={
                              piece.id
                            }
                            currentStatus={
                              piece.status
                            }
                          />

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>
        )
      )}

    </div>
  );
}

/*
 * =====================================
 * ASIGNACIÓN
 * =====================================
 */

function AssignmentTable({
  pieces,
  profiles,
}: {
  pieces: any[];
  profiles: Profile[];
}) {
  if (
    pieces.length ===
    0
  ) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-700">
        No hay piezas listas para comenzar edición.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">

      {pieces.map(
        (piece) => {
          const groupName =
            relationValue(
              piece.deliverable_groups,
              "name"
            );

          const responsibleName =
            relationValue(
              piece.responsible,
              "full_name"
            );

          const context =
            getPieceContext(
              piece
            );

          return (
            <div
              key={
                piece.id
              }
              className="grid gap-6 px-6 py-5 xl:grid-cols-[1.1fr_0.8fr_1fr]"
            >

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <Link
                    href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                    className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                  >
                    {
                      piece.name
                    }
                  </Link>

                  {piece.urgent && (
                    <span className="rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      Urgente
                    </span>
                  )}

                </div>

                <p className="mt-1 text-xs text-zinc-700">
                  {groupName ??
                    "Sin grupo"}
                </p>

                <p className="mt-3 text-xs text-zinc-500">
                  {
                    context.clientName
                  }
                </p>

                <p className="mt-1 text-xs text-zinc-700">
                  {
                    context.projectName
                  }
                  {" · "}
                  {
                    context.jobName
                  }
                </p>

              </div>

              <div>

                <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-700">
                  Responsable
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {responsibleName ??
                    "Sin responsable"}
                </p>

                <p className="mt-4 text-[11px] uppercase tracking-[0.08em] text-zinc-700">
                  Deadline
                </p>

                <p
                  className={`mt-1 text-xs ${
                    isOverdue(
                      piece.deadline
                    )
                      ? "text-red-400"
                      : "text-zinc-400"
                  }`}
                >
                  {piece.deadline
                    ? formatDate(
                        piece.deadline
                      )
                    : "Sin deadline"}
                </p>

              </div>

              <AssignEditorForm
                initialEditorId={piece.editor_user_id}
                pieceId={
                  piece.id
                }
                profiles={
                  profiles
                }
              />

            </div>
          );
        }
      )}

    </div>
  );
}

/*
 * =====================================
 * REVISIONES / CLIENTE / APROBADO
 * =====================================
 */

function ReviewTable({
  pieces,
  lastSendByPiece,
  showLastSend = false,
}: {
  pieces: any[];

  lastSendByPiece: Map<
    string,
    LastSend
  >;

  showLastSend?: boolean;
}) {
  if (
    pieces.length ===
    0
  ) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-700">
        No hay piezas en esta sección.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">

      {pieces.map(
        (piece) => {
          const editorName =
            relationValue(
              piece.editor,
              "full_name"
            );

          const context =
            getPieceContext(
              piece
            );

          const lastSend =
            lastSendByPiece.get(
              piece.id
            );

          const methodName =
            relationValue(
              lastSend?.delivery_methods,
              "name"
            );

          return (
            <div
              key={
                piece.id
              }
              className={`grid gap-5 px-6 py-5 ${
                showLastSend
                  ? "xl:grid-cols-[1.1fr_0.55fr_0.65fr_1fr_1fr]"
                  : "xl:grid-cols-[1.2fr_0.7fr_0.8fr_1fr]"
              }`}
            >

              {/* PIEZA */}

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <Link
                    href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                    className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                  >
                    {
                      piece.name
                    }
                  </Link>

                  {piece.urgent && (
                    <span className="rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      Urgente
                    </span>
                  )}

                  {piece.current_version &&
                    Number(
                      piece.current_version
                    ) > 0 && (
                      <VersionBadge
                        version={
                          piece.current_version
                        }
                      />
                    )}

                </div>

                <p className="mt-1 text-xs text-zinc-700">
                  {
                    context.clientName
                  }
                  {" · "}
                  {
                    context.projectName
                  }
                </p>

              </div>

              {/* EDITOR */}

              <div>

                <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                  Editor
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {editorName ??
                    "Sin editor"}
                </p>

              </div>

              {/* ESTADO */}

              <div>

                <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                  Estado
                </p>

                <div className="mt-1">

                  <StatusBadge
                    status={
                      piece.status
                    }
                  />

                </div>

              </div>

              {/* ÚLTIMO ENVÍO */}

              {showLastSend && (
                <div>

                  <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                    Último envío
                  </p>

                  {lastSend ? (
                    <div className="mt-1 space-y-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <Send
                          size={12}
                          className="text-zinc-600"
                        />

                        <span className="text-xs text-zinc-400">
                          {methodName ??
                            "Sin método"}
                        </span>

                      </div>

                      <p className="text-[11px] text-zinc-700">
                        {formatDateTime(
                          lastSend.sent_at
                        )}
                      </p>

                      {lastSend.link && (
                        <a
                          href={
                            lastSend.link
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#45B8E8] transition hover:text-white"
                        >
                          <ExternalLink
                            size={11}
                          />

                          Abrir envío
                        </a>
                      )}

                      {lastSend.comment && (
                        <p className="max-w-[240px] truncate text-[11px] text-zinc-600">
                          {
                            lastSend.comment
                          }
                        </p>
                      )}

                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-700">
                      Sin envío registrado
                    </p>
                  )}

                </div>
              )}

              {/* ACCIONES */}

              <div className="flex items-center xl:justify-end">

                <ReviewActions
                  pieceId={
                    piece.id
                  }
                  currentStatus={
                    piece.status
                  }
                  editorId={
                    piece.editor_user_id
                  }
                />

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
 * TABLA SIMPLE
 * =====================================
 */

function PieceTable({
  pieces,
}: {
  pieces: any[];
}) {
  if (
    pieces.length ===
    0
  ) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-700">
        No hay piezas en esta sección.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">

      {pieces.map(
        (piece) => {
          const context =
            getPieceContext(
              piece
            );

          const editorName =
            relationValue(
              piece.editor,
              "full_name"
            );

          return (
            <div
              key={
                piece.id
              }
              className="grid gap-4 px-6 py-5 md:grid-cols-[1.3fr_1fr_1fr]"
            >

              <div>

                <div className="flex flex-wrap items-center gap-2">

                  <Link
                    href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                    className="text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                  >
                    {
                      piece.name
                    }
                  </Link>

                  {piece.current_version &&
                    Number(
                      piece.current_version
                    ) > 0 && (
                      <VersionBadge
                        version={
                          piece.current_version
                        }
                      />
                    )}

                </div>

                <p className="mt-1 text-xs text-zinc-700">
                  {
                    context.clientName
                  }
                  {" · "}
                  {
                    context.projectName
                  }
                </p>

              </div>

              <div>

                <p className="text-xs text-zinc-500">
                  {editorName ??
                    "Sin editor"}
                </p>

              </div>

              <div>

                <StatusBadge
                  status={
                    piece.status
                  }
                />

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
    Array.isArray(
      piece.jobs
    )
      ? piece.jobs[0]
      : piece.jobs;

  const projectRelation =
    jobObject &&
    typeof jobObject ===
      "object"
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
    Array.isArray(
      projectRelation
    )
      ? projectRelation[0]
      : projectRelation;

  const clientRelation =
    projectObject &&
    typeof projectObject ===
      "object"
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
 * SECCIONES
 * =====================================
 */

function EditingSection({
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
 * MÉTRICA
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
      label:
        "Definido",
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-400",
    },

    PENDING_MATERIAL: {
      label:
        "Pendiente material",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    READY_POST: {
      label:
        "Listo para post",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    EDITING: {
      label:
        "En edición",
      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    COORDINATOR_REVIEW: {
      label:
        "Revisión coordinador",
      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    INTERNAL_REVIEW: {
      label:
        "Revisión interna",
      className:
        "border-indigo-900/50 bg-indigo-950/30 text-indigo-400",
    },

    CLIENT_REVIEW: {
      label:
        "Revisión cliente",
      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },

    CORRECTIONS: {
      label:
        "Correcciones",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },

    APPROVED: {
      label:
        "Aprobado",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },
  };

  const current =
    config[status] ?? {
      label:
        status,
      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${current.className}`}
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

function isOverdue(
  value: string | null
) {
  if (!value) {
    return false;
  }

  return (
    new Date(
      value
    ) <
    new Date()
  );
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
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
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
