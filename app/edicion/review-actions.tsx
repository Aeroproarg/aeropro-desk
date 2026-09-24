"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Check,
  CheckCheck,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Props = {
  pieceId: string;
  currentStatus: string;
  editorId: string | null;
};

type DeliveryMethod = {
  id: string;
  name: string;
};

export default function ReviewActions({
  pieceId,
  currentStatus,
  editorId,
}: Props) {
  const router = useRouter();

  const [savingAction, setSavingAction] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * =====================================
   * ENVÍO AL CLIENTE
   * =====================================
   */

  const [
    deliveryMethods,
    setDeliveryMethods,
  ] = useState<DeliveryMethod[]>([]);

  const [
    deliveryMethodId,
    setDeliveryMethodId,
  ] = useState("");

  const [
    sendLink,
    setSendLink,
  ] = useState("");

  const [
    sendComment,
    setSendComment,
  ] = useState("");

  /*
   * =====================================
   * FEEDBACK / CORRECCIONES
   * =====================================
   */

  const [
    correctionsOpen,
    setCorrectionsOpen,
  ] = useState(false);

  const [
    feedbackSummary,
    setFeedbackSummary,
  ] = useState("");

  /*
   * =====================================
   * CARGAR MÉTODOS
   * =====================================
   */

  useEffect(() => {
    async function loadMethods() {
      const {
        data,
        error,
      } = await supabase
        .from("delivery_methods")
        .select(`
          id,
          name
        `)
        .order("name");

      if (error) {
        console.error(
          "Error loading delivery methods:",
          error
        );

        return;
      }

      setDeliveryMethods(
        (data ?? []) as DeliveryMethod[]
      );
    }

    loadMethods();
  }, []);

  /*
   * =====================================
   * UPDATE SIMPLE DE PIEZA
   * =====================================
   */

  async function updatePiece(
    action: string,
    newStatus: string,
    extraData: Record<string, unknown> = {}
  ) {
    if (savingAction) return;

    setSavingAction(action);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("deliverables")
        .update({
          status: newStatus,
          updated_at:
            new Date().toISOString(),

          ...extraData,
        })
        .eq(
          "id",
          pieceId
        )
        .select(`
          id,
          status
        `)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "No se pudo recuperar la pieza actualizada."
        );
      }

      if (
        data.status !==
        newStatus
      ) {
        throw new Error(
          `La pieza quedó en ${data.status} y debería estar en ${newStatus}.`
        );
      }

      router.refresh();

      setSavingAction(null);
    } catch (error) {
      console.error(
        "Error updating deliverable:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la pieza."
      );

      setSavingAction(null);
    }
  }

  /*
   * =====================================
   * COORDINADOR
   * →
   * REVISIÓN INTERNA
   * =====================================
   */

  async function sendToInternalReview() {
    await updatePiece(
      "internal",
      "INTERNAL_REVIEW"
    );
  }

  /*
   * =====================================
   * REVISIÓN INTERNA
   * →
   * CLIENTE
   *
   * CREA V1 / V2 / V3...
   * =====================================
   */

  async function sendToClient() {
    if (savingAction) return;

    setErrorMessage("");

    if (!deliveryMethodId) {
      setErrorMessage(
        "Elegí cómo se envió al cliente."
      );

      return;
    }

    setSavingAction("client");

    try {
      /*
       * USUARIO ACTUAL
       */

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "No se pudo identificar al usuario."
        );
      }

      /*
       * PIEZA ACTUAL
       */

      const {
        data: currentPiece,
        error: pieceError,
      } = await supabase
        .from("deliverables")
        .select(`
          id,
          current_version,
          actual_first_cut_at
        `)
        .eq(
          "id",
          pieceId
        )
        .single();

      if (pieceError) {
        throw pieceError;
      }

      if (!currentPiece) {
        throw new Error(
          "No se encontró la pieza."
        );
      }

      /*
       * ÚLTIMA VERSIÓN REAL
       */

      const {
        data: lastVersion,
        error: versionLookupError,
      } = await supabase
        .from("deliverable_versions")
        .select(`
          id,
          version_number
        `)
        .eq(
          "deliverable_id",
          pieceId
        )
        .order(
          "version_number",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (versionLookupError) {
        throw versionLookupError;
      }

      const nextVersionNumber =
        lastVersion
          ? Number(
              lastVersion.version_number
            ) + 1
          : 1;

      const sentAt =
        new Date().toISOString();

      /*
       * =====================================
       * CREAR VERSIÓN
       * =====================================
       */

      const {
        data: newVersion,
        error: versionError,
      } = await supabase
        .from("deliverable_versions")
        .insert({
          deliverable_id:
            pieceId,

          version_number:
            nextVersionNumber,

          review_url:
            sendLink.trim() || null,

          created_by_user_id:
            user.id,

          sent_to_client_at:
            sentAt,
        })
        .select(`
          id,
          version_number
        `)
        .single();

      if (versionError) {
        throw versionError;
      }

      if (!newVersion) {
        throw new Error(
          "No se pudo crear la nueva versión."
        );
      }

      /*
       * =====================================
       * REGISTRAR ENVÍO
       * =====================================
       */

      const {
        error: sendError,
      } = await supabase
        .from("client_sends")
        .insert({
          deliverable_id:
            pieceId,

          version_id:
            newVersion.id,

          sent_by_user_id:
            user.id,

          delivery_method_id:
            deliveryMethodId,

          sent_at:
            sentAt,

          link:
            sendLink.trim() || null,

          comment:
            sendComment.trim() || null,
        });

      if (sendError) {
        throw sendError;
      }

      /*
       * =====================================
       * RESOLVER FEEDBACK PENDIENTE
       *
       * Si estamos mandando V2, V3...
       * significa que las correcciones
       * anteriores ya fueron trabajadas.
       * =====================================
       */

      const {
        error: feedbackResolveError,
      } = await supabase
        .from("feedback_items")
        .update({
          status:
            "RESOLVED",

          resolved_at:
            sentAt,
        })
        .eq(
          "deliverable_id",
          pieceId
        )
        .eq(
          "status",
          "PENDING"
        );

      if (feedbackResolveError) {
        throw feedbackResolveError;
      }

      /*
       * =====================================
       * ACTUALIZAR PIEZA
       * =====================================
       */

      const updateData: Record<
        string,
        unknown
      > = {
        status:
          "CLIENT_REVIEW",

        current_version:
          nextVersionNumber,

        queue_position:
          null,

        updated_at:
          sentAt,
      };

      /*
       * Primer corte real:
       * solo la primera vez.
       */

      if (
        !currentPiece.actual_first_cut_at
      ) {
        updateData.actual_first_cut_at =
          sentAt;
      }

      const {
        data: updatedPiece,
        error: updateError,
      } = await supabase
        .from("deliverables")
        .update(
          updateData
        )
        .eq(
          "id",
          pieceId
        )
        .select(`
          id,
          status,
          current_version
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      if (
        !updatedPiece ||
        updatedPiece.status !==
          "CLIENT_REVIEW"
      ) {
        throw new Error(
          "La pieza no pudo pasar a revisión del cliente."
        );
      }

      /*
       * LIMPIAR FORMULARIO
       */

      setDeliveryMethodId("");
      setSendLink("");
      setSendComment("");

      router.refresh();

      setSavingAction(null);
    } catch (error) {
      console.error(
        "Error sending version to client:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el envío al cliente."
      );

      setSavingAction(null);
    }
  }

  /*
   * =====================================
   * CLIENTE
   * →
   * CORRECCIONES
   *
   * GUARDA FEEDBACK
   * =====================================
   */

  async function sendToCorrections() {
    if (savingAction) return;

    setErrorMessage("");

    if (!editorId) {
      setErrorMessage(
        "La pieza no tiene editor asignado."
      );

      return;
    }

    if (
      !feedbackSummary.trim()
    ) {
      setErrorMessage(
        "Escribí qué correcciones pidió el cliente."
      );

      return;
    }

    setSavingAction(
      "corrections"
    );

    try {
      /*
       * USUARIO ACTUAL
       */

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "No se pudo identificar al usuario."
        );
      }

      /*
       * =====================================
       * BUSCAR ÚLTIMA VERSIÓN
       * =====================================
       */

      const {
        data: lastVersion,
        error: versionError,
      } = await supabase
        .from("deliverable_versions")
        .select(`
          id,
          version_number
        `)
        .eq(
          "deliverable_id",
          pieceId
        )
        .order(
          "version_number",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (versionError) {
        throw versionError;
      }

      /*
       * =====================================
       * GUARDAR FEEDBACK
       * =====================================
       */

      const {
        error: feedbackError,
      } = await supabase
        .from("feedback_items")
        .insert({
          deliverable_id:
            pieceId,

          version_id:
            lastVersion?.id ?? null,

          origin:
            "CLIENT",

          summary:
            feedbackSummary.trim(),

          status:
            "PENDING",

          logged_by_user_id:
            user.id,
        });

      if (feedbackError) {
        throw feedbackError;
      }

      /*
       * =====================================
       * BUSCAR ÚLTIMA POSICIÓN
       * DE LA COLA DEL EDITOR
       * =====================================
       */

      const {
        data: queueItems,
        error: queueError,
      } = await supabase
        .from("deliverables")
        .select(`
          id,
          queue_position
        `)
        .eq(
          "editor_user_id",
          editorId
        )
        .in(
          "status",
          [
            "EDITING",
            "CORRECTIONS",
          ]
        )
        .not(
          "queue_position",
          "is",
          null
        )
        .order(
          "queue_position",
          {
            ascending: false,
          }
        )
        .limit(1);

      if (queueError) {
        throw queueError;
      }

      const lastPosition =
        queueItems?.[0]
          ?.queue_position ?? 0;

      const newPosition =
        Number(
          lastPosition
        ) + 1;

      /*
       * =====================================
       * PASAR A CORRECCIONES
       * =====================================
       */

      const {
        data: updatedPiece,
        error: updateError,
      } = await supabase
        .from("deliverables")
        .update({
          status:
            "CORRECTIONS",

          queue_position:
            newPosition,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          pieceId
        )
        .select(`
          id,
          status,
          queue_position
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      if (
        !updatedPiece ||
        updatedPiece.status !==
          "CORRECTIONS"
      ) {
        throw new Error(
          "La pieza no pudo pasar a correcciones."
        );
      }

      setFeedbackSummary("");
      setCorrectionsOpen(false);

      router.refresh();

      setSavingAction(null);
    } catch (error) {
      console.error(
        "Error creating client feedback:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron registrar las correcciones."
      );

      setSavingAction(null);
    }
  }

  /*
   * =====================================
   * CLIENTE
   * →
   * APROBADO
   * =====================================
   */

  async function approvePiece() {
    await updatePiece(
      "approve",
      "APPROVED",
      {
        queue_position:
          null,
      }
    );
  }

  /*
   * =====================================
   * APROBADO
   * →
   * ENTREGADO
   * =====================================
   */

  async function markDelivered() {
    await updatePiece(
      "delivered",
      "DELIVERED",
      {
        queue_position:
          null,
      }
    );
  }

  /*
   * =====================================
   * UI
   * =====================================
   */

  return (
    <div className="space-y-3">

      {/* =====================================
          REVISIÓN COORDINADOR
      ===================================== */}

      {currentStatus ===
        "COORDINATOR_REVIEW" && (
        <button
          type="button"
          onClick={
            sendToInternalReview
          }
          disabled={
            Boolean(
              savingAction
            )
          }
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 text-[11px] font-medium text-indigo-400 transition hover:bg-indigo-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck
            size={13}
          />

          {savingAction ===
          "internal"
            ? "Pasando..."
            : "A revisión interna"}
        </button>
      )}

      {/* =====================================
          ENVÍO DE NUEVA VERSIÓN
      ===================================== */}

      {currentStatus ===
        "INTERNAL_REVIEW" && (
        <div className="min-w-[280px] space-y-2 rounded-xl border border-white/10 bg-[#07090B] p-3">

          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
            Enviar nueva versión
          </p>

          <select
            value={
              deliveryMethodId
            }
            onChange={(e) =>
              setDeliveryMethodId(
                e.target.value
              )
            }
            disabled={
              Boolean(
                savingAction
              )
            }
            className="h-9 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-xs text-zinc-300 outline-none transition focus:border-[#20A4DD]"
          >
            <option value="">
              Método de envío
            </option>

            {deliveryMethods.map(
              (method) => (
                <option
                  key={
                    method.id
                  }
                  value={
                    method.id
                  }
                >
                  {
                    method.name
                  }
                </option>
              )
            )}
          </select>

          <input
            type="url"
            value={
              sendLink
            }
            onChange={(e) =>
              setSendLink(
                e.target.value
              )
            }
            placeholder="Link de revisión / Drive (opcional)"
            disabled={
              Boolean(
                savingAction
              )
            }
            className="h-9 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-xs text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
          />

          <input
            type="text"
            value={
              sendComment
            }
            onChange={(e) =>
              setSendComment(
                e.target.value
              )
            }
            placeholder="Comentario (opcional)"
            disabled={
              Boolean(
                savingAction
              )
            }
            className="h-9 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-xs text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
          />

          <button
            type="button"
            onClick={
              sendToClient
            }
            disabled={
              Boolean(
                savingAction
              )
            }
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-orange-900/40 bg-orange-950/20 px-3 text-xs font-medium text-orange-400 transition hover:bg-orange-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send
              size={13}
            />

            {savingAction ===
            "client"
              ? "Registrando envío..."
              : "Enviar al cliente"}
          </button>

        </div>
      )}

      {/* =====================================
          CLIENTE
      ===================================== */}

      {currentStatus ===
        "CLIENT_REVIEW" && (
        <div className="space-y-2">

          {!correctionsOpen ? (
            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={() => {
                  setCorrectionsOpen(
                    true
                  );

                  setErrorMessage("");
                }}
                disabled={
                  Boolean(
                    savingAction
                  )
                }
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 text-[11px] font-medium text-red-400 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw
                  size={13}
                />

                Correcciones
              </button>

              <button
                type="button"
                onClick={
                  approvePiece
                }
                disabled={
                  Boolean(
                    savingAction
                  )
                }
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check
                  size={13}
                />

                {savingAction ===
                "approve"
                  ? "Aprobando..."
                  : "Aprobar"}
              </button>

            </div>
          ) : (

            <div className="min-w-[320px] space-y-3 rounded-xl border border-red-900/30 bg-red-950/10 p-3">

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <MessageSquareText
                    size={14}
                    className="text-red-400"
                  />

                  <p className="text-[11px] font-medium text-zinc-300">
                    Correcciones del cliente
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectionsOpen(
                      false
                    );

                    setErrorMessage("");
                  }}
                  disabled={
                    Boolean(
                      savingAction
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-white"
                >
                  <X
                    size={14}
                  />
                </button>

              </div>

              <textarea
                value={
                  feedbackSummary
                }
                onChange={(e) =>
                  setFeedbackSummary(
                    e.target.value
                  )
                }
                placeholder="Ej: Cambiar música, corregir placa final y reemplazar toma de drone..."
                rows={4}
                disabled={
                  Boolean(
                    savingAction
                  )
                }
                className="w-full resize-none rounded-lg border border-white/10 bg-[#050607] px-3 py-2.5 text-xs leading-relaxed text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-red-900/60"
              />

              <button
                type="button"
                onClick={
                  sendToCorrections
                }
                disabled={
                  Boolean(
                    savingAction
                  )
                }
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 text-xs font-medium text-red-400 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw
                  size={13}
                />

                {savingAction ===
                "corrections"
                  ? "Guardando correcciones..."
                  : "Guardar y enviar al editor"}
              </button>

            </div>

          )}

        </div>
      )}

      {/* =====================================
          APROBADO
      ===================================== */}

      {currentStatus ===
        "APPROVED" && (
        <button
          type="button"
          onClick={
            markDelivered
          }
          disabled={
            Boolean(
              savingAction
            )
          }
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck
            size={13}
          />

          {savingAction ===
          "delivered"
            ? "Marcando..."
            : "Marcar entregado"}
        </button>
      )}

      {/* =====================================
          ERROR
      ===================================== */}

      {errorMessage && (
        <div className="max-w-[360px] rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2 text-[11px] leading-relaxed text-red-400">
          {
            errorMessage
          }
        </div>
      )}

    </div>
  );
}