import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { folderProgress, type NasEntry } from "@/utils/nas-downloads";

export default async function NasDownloadSummary({ productionId }: { productionId: string }) {
  const supabase = await createClient();
  const { data: plan, error } = await supabase.from("nas_folder_plans")
    .select("root_name,entries,nas_folder_downloads(equipment_id)")
    .eq("production_id", productionId).maybeSingle();
  if (error) return <section className="mb-6 rounded-xl border border-white/10 p-5">
    <p className="text-sm text-zinc-400">No se pudo consultar el avance de descargas por carpeta.</p>
    <Link className="mt-2 inline-block text-sm text-cyan-400" href={`/producciones/${productionId}/carpeta-nas`}>Ver carpetas y descargas →</Link>
  </section>;
  if (!plan) return null;
  const progress = folderProgress(plan.entries as NasEntry[], plan.nas_folder_downloads);
  return <section className="mb-6 rounded-xl border border-white/10 bg-[#0B0F12] p-5">
    <h2 className="font-semibold text-zinc-200">Descargas por carpeta</h2>
    <p className="mt-2 text-lg text-cyan-200">{progress.completed} de {progress.total} carpetas descargadas</p>
    <p className="mt-1 break-all text-xs text-zinc-500">{plan.root_name}</p>
    <p className="mt-2 text-xs text-zinc-500">Confirmaciones manuales de copia. El backup se registra por separado.</p>
    <Link className="mt-3 inline-block text-sm text-cyan-400" href={`/producciones/${productionId}/carpeta-nas`}>Ver carpetas y registrar descargas →</Link>
  </section>;
}
