import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { folderProgress, materialReadiness, type NasEntry } from "@/utils/nas-downloads";

export default async function NasDownloadSummary({ productionId }: { productionId: string }) {
  const supabase = await createClient();
  const { data: plan, error } = await supabase.from("nas_folder_plans")
    .select("root_name,state,entries,nas_folder_downloads(equipment_id)")
    .eq("production_id", productionId).maybeSingle();
  if (error) return <section className="mb-6 rounded-xl border border-white/10 p-5">
    <p className="text-sm text-zinc-400">No se pudo consultar el avance de descargas por carpeta.</p>
    <Link className="mt-2 inline-block text-sm text-cyan-400" href={`/producciones/${productionId}/carpeta-nas`}>Ver carpetas y descargas →</Link>
  </section>;
  if (!plan) return null;
  const progress = folderProgress(plan.entries as NasEntry[], plan.nas_folder_downloads);
  const material = materialReadiness(plan.state, progress);
  return <section className="mb-6 rounded-xl border border-white/10 bg-[#0B0F12] p-5">
    <h2 className="font-semibold text-zinc-200">Descargas por carpeta</h2>
    <p className={`mt-2 text-lg ${material.ready ? "text-emerald-300" : "text-amber-200"}`}>{material.label}</p>
    {material.ready && <p className="mt-1 text-sm text-zinc-300">{progress.completed} de {progress.total} carpetas descargadas. La edición todavía debe iniciarse desde su cola.</p>}
    <p className="mt-1 break-all text-xs text-zinc-500">{plan.root_name}</p>
    <p className="mt-2 text-xs text-zinc-500">Confirmaciones manuales de copia. El backup se registra por separado.</p>
    <Link className="mt-3 inline-block text-sm text-cyan-400" href={`/producciones/${productionId}/carpeta-nas`}>Ver carpetas y registrar descargas →</Link>
    {material.ready && <Link className="ml-4 mt-3 inline-block text-sm text-cyan-400" href="/edicion">Ir a Edición →</Link>}
  </section>;
}
