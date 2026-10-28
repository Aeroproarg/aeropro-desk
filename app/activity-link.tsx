import Link from "next/link";
import { History } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

// Botón "Actividad" en la ficha de un trabajo o producción.
// Solo aparece para quien puede ver el historial (Coordinación o Administración).
export default async function ActivityLink({ kind, id }: { kind: "trabajo" | "produccion"; id: string }) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_view_activity");
  if (allowed !== true) return null;
  return (
    <Link
      href={`/actividad?${kind}=${id}`}
      title="Quién hizo qué en este registro"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-4 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
    >
      <History size={15} />
      Actividad
    </Link>
  );
}
