"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CalendarClock,
  UserRoundPlus,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

type AssignEditorFormProps = {
  pieceId: string;
  profiles: Profile[];
};

export default function AssignEditorForm({
  pieceId,
  profiles,
}: AssignEditorFormProps) {
  const router = useRouter();

  const [editorId, setEditorId] = useState("");
  const [targetFirstCutAt, setTargetFirstCutAt] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleAssign() {
    if (saving) return;

    setErrorMessage("");

    if (!editorId) {
      setErrorMessage("Elegí un editor.");
      return;
    }

    if (!targetFirstCutAt) {
      setErrorMessage(
        "Definí el objetivo de primer corte."
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * Buscamos la última posición
       * actual de la cola de este editor.
       */
      const { data: queueItems, error: queueError } =
        await supabase
          .from("deliverables")
          .select("queue_position")
          .eq("editor_user_id", editorId)
          .in("status", [
            "EDITING",
            "CORRECTIONS",
          ])
          .not("queue_position", "is", null)
          .order("queue_position", {
            ascending: false,
          })
          .limit(1);

      if (queueError) {
        throw queueError;
      }

      const lastPosition =
        queueItems?.[0]?.queue_position ?? 0;

      const newPosition =
        Number(lastPosition) + 1;

      /*
       * Asignamos editor,
       * primer corte,
       * estado y posición.
       */
      const { error } = await supabase
        .from("deliverables")
        .update({
          editor_user_id: editorId,

          target_first_cut_at:
            new Date(
              targetFirstCutAt
            ).toISOString(),

          status: "EDITING",

          queue_position:
            newPosition,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", pieceId)
        .eq("status", "READY_POST");

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Error assigning editor:",
        error
      );

      setErrorMessage(
        "No se pudo asignar el editor."
      );

      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">

      <div className="grid gap-2 xl:grid-cols-2">

        <div className="relative">

          <UserRoundPlus
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
          />

          <select
            value={editorId}
            onChange={(e) =>
              setEditorId(
                e.target.value
              )
            }
            disabled={saving}
            className="h-9 w-full rounded-lg border border-white/10 bg-[#050607] pl-9 pr-3 text-xs text-zinc-300 outline-none transition focus:border-[#20A4DD] disabled:opacity-50"
          >
            <option value="">
              Seleccionar editor
            </option>

            {profiles.map(
              (profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                >
                  {profile.full_name}
                </option>
              )
            )}
          </select>

        </div>

        <div className="relative">

          <CalendarClock
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
          />

          <input
            type="datetime-local"
            value={targetFirstCutAt}
            onChange={(e) =>
              setTargetFirstCutAt(
                e.target.value
              )
            }
            disabled={saving}
            className="h-9 w-full rounded-lg border border-white/10 bg-[#050607] pl-9 pr-3 text-xs text-zinc-300 outline-none transition focus:border-[#20A4DD] disabled:opacity-50"
          />

        </div>

      </div>

      <button
        type="button"
        onClick={handleAssign}
        disabled={saving}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-3 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserRoundPlus size={14} />

        {saving
          ? "Asignando..."
          : "Asignar y comenzar edición"}
      </button>

      {errorMessage && (
        <p className="text-xs text-red-400">
          {errorMessage}
        </p>
      )}

    </div>
  );
}