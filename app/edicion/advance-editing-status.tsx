"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CheckCheck,
  RotateCcw,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Props = {
  pieceId: string;
  currentStatus: string;
};

export default function AdvanceEditingStatus({
  pieceId,
  currentStatus,
}: Props) {
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Esta acción sirve tanto para:
   *
   * EDITING
   * →
   * COORDINATOR_REVIEW
   *
   * como para:
   *
   * CORRECTIONS
   * →
   * COORDINATOR_REVIEW
   */

  async function handleAdvance() {
    if (saving) return;

    const canAdvance =
      currentStatus === "EDITING" ||
      currentStatus === "CORRECTIONS";

    if (!canAdvance) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("deliverables")
        .update({
          status:
            "COORDINATOR_REVIEW",

          /*
           * Cuando sale de la cola
           * deja de ocupar una posición.
           */
          queue_position: null,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", pieceId)
        .select(`
          id,
          status,
          queue_position
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
        "COORDINATOR_REVIEW"
      ) {
        throw new Error(
          `La pieza quedó en ${data.status} y debería estar en revisión de coordinación.`
        );
      }

      router.refresh();

      setSaving(false);
    } catch (error) {
      console.error(
        "Error advancing editing status:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la pieza a revisión."
      );

      setSaving(false);
    }
  }

  const canAdvance =
    currentStatus === "EDITING" ||
    currentStatus === "CORRECTIONS";

  if (!canAdvance) {
    return null;
  }

  const isCorrection =
    currentStatus === "CORRECTIONS";

  return (
    <div className="space-y-1.5">

      <button
        type="button"
        onClick={
          handleAdvance
        }
        disabled={
          saving
        }
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-50"
      >

        {isCorrection ? (
          <RotateCcw
            size={13}
          />
        ) : (
          <CheckCheck
            size={13}
          />
        )}

        {saving
          ? "Pasando..."
          : isCorrection
            ? "Enviar corrección a revisión"
            : "Enviar a revisión"}

      </button>

      {errorMessage && (
        <div className="max-w-[280px] rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2 text-[10px] leading-relaxed text-red-400">
          {errorMessage}
        </div>
      )}

    </div>
  );
}