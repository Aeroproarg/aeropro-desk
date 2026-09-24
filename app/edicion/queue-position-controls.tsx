"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowDown,
  ArrowUp,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Props = {
  pieceId: string;
  editorId: string;
  queuePosition: number | null;
};

export default function QueuePositionControls({
  pieceId,
  editorId,
  queuePosition,
}: Props) {
  const router = useRouter();

  const [moving, setMoving] =
    useState(false);

  async function move(
    direction: "up" | "down"
  ) {
    if (
      moving ||
      queuePosition == null
    ) {
      return;
    }

    setMoving(true);

    try {
      /*
       * Buscamos la pieza inmediatamente
       * anterior o posterior.
       */

      let query = supabase
        .from("deliverables")
        .select(`
          id,
          queue_position
        `)
        .eq(
          "editor_user_id",
          editorId
        )
        .in("status", [
          "EDITING",
          "CORRECTIONS",
        ])
        .not(
          "queue_position",
          "is",
          null
        );

      if (direction === "up") {
        query = query
          .lt(
            "queue_position",
            queuePosition
          )
          .order(
            "queue_position",
            {
              ascending: false,
            }
          );
      } else {
        query = query
          .gt(
            "queue_position",
            queuePosition
          )
          .order(
            "queue_position",
            {
              ascending: true,
            }
          );
      }

      const {
        data: neighbor,
        error: neighborError,
      } = await query.limit(1).maybeSingle();

      if (neighborError) {
        throw neighborError;
      }

      if (!neighbor) {
        setMoving(false);
        return;
      }

      /*
       * Intercambiamos posiciones.
       */

      const neighborPosition =
        neighbor.queue_position;

      const temporaryPosition =
        -999999;

      const { error: tempError } =
        await supabase
          .from("deliverables")
          .update({
            queue_position:
              temporaryPosition,
          })
          .eq(
            "id",
            pieceId
          );

      if (tempError) {
        throw tempError;
      }

      const { error: neighborUpdateError } =
        await supabase
          .from("deliverables")
          .update({
            queue_position:
              queuePosition,
          })
          .eq(
            "id",
            neighbor.id
          );

      if (neighborUpdateError) {
        throw neighborUpdateError;
      }

      const { error: finalError } =
        await supabase
          .from("deliverables")
          .update({
            queue_position:
              neighborPosition,
          })
          .eq(
            "id",
            pieceId
          );

      if (finalError) {
        throw finalError;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Error moving queue item:",
        error
      );

      setMoving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">

      <button
        type="button"
        onClick={() =>
          move("up")
        }
        disabled={
          moving ||
          queuePosition == null
        }
        title="Subir en la cola"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
      >
        <ArrowUp size={14} />
      </button>

      <button
        type="button"
        onClick={() =>
          move("down")
        }
        disabled={
          moving ||
          queuePosition == null
        }
        title="Bajar en la cola"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
      >
        <ArrowDown size={14} />
      </button>

    </div>
  );
}