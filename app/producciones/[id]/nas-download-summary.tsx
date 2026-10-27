import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  folderProgress, jobEditingSummary, materialReadiness,
  type NasDownload, type NasEntry, type NasJobSource,
} from "@/utils/nas-downloads";

type PlanRow = { state: string; entries: NasEntry[]; nas_folder_downloads: Pick<NasDownload, "equipment_id">[] | null };
type SourceRow = { job_id: string; production_id: string; productions: { name: string; nas_folder_plans: PlanRow | PlanRow[] | null } | null };

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
    {material.ready && <EditingJobs productionId={productionId} />}
    <Link className="mt-3 inline-block text-sm text-cyan-400" href={`/producciones/${productionId}/carpeta-nas`}>Ver carpetas y registrar descargas →</Link>
    {material.ready && <Link className="ml-4 mt-3 inline-block text-sm text-cyan-400" href="/edicion">Ir a Edición →</Link>}
  </section>;
}

// Solo lectura: explica por qué Edición muestra o no piezas para esta producción.
async function EditingJobs({ productionId }: { productionId: string }) {
  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase.from("production_jobs")
    .select("job_id, jobs:job_id(id,name)").eq("production_id", productionId);
  if (linksError) return null;
  const jobs = ((links ?? []) as unknown as { job_id: string; jobs: { id: string; name: string } | null }[])
    .map(link => ({ id: link.job_id, name: link.jobs?.name ?? "Trabajo sin nombre" }));

  if (jobs.length === 0) return <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
    <p className="text-amber-200">Esta producción no está vinculada a ningún trabajo, así que no va a habilitar piezas en Edición.</p>
    <Link className="mt-1 inline-block text-cyan-400" href={`/producciones/${productionId}/trabajos`}>Vincular trabajos →</Link>
  </div>;

  const jobIds = jobs.map(job => job.id);
  const [sourcesResult, piecesResult] = await Promise.all([
    supabase.from("production_jobs")
      .select("job_id, production_id, productions:production_id(name, nas_folder_plans(state,entries,nas_folder_downloads(equipment_id)))")
      .in("job_id", jobIds),
    supabase.from("deliverables").select("job_id,status").in("job_id", jobIds),
  ]);
  if (sourcesResult.error || piecesResult.error) return null;

  const sources = (sourcesResult.data ?? []) as unknown as SourceRow[];
  const pieces = (piecesResult.data ?? []) as { job_id: string; status: string }[];
  const tones = { ok: "text-emerald-300", warn: "text-amber-200", info: "text-zinc-400" };

  return <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
    <p className="text-xs uppercase tracking-wide text-zinc-500">Trabajos vinculados en Edición</p>
    {jobs.map(job => {
      const jobSources: NasJobSource[] = sources.filter(row => row.job_id === job.id).map(row => {
        const raw = row.productions?.nas_folder_plans;
        const planRow = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
        return {
          productionId: row.production_id,
          name: row.productions?.name ?? "Producción sin acceso",
          plan: planRow && { state: planRow.state, entries: planRow.entries ?? [], downloads: planRow.nas_folder_downloads ?? [] },
        };
      });
      const summary = jobEditingSummary(pieces.filter(piece => piece.job_id === job.id).map(piece => piece.status), jobSources, productionId);
      return <div key={job.id} className="text-sm">
        <Link className="text-zinc-200 hover:text-cyan-400" href={`/trabajos/${job.id}`}>{job.name}</Link>
        <p className={tones[summary.tone]}>{summary.message}</p>
        {summary.blockers.length > 0 && <ul className="mt-1 list-disc pl-5 text-zinc-400">
          {summary.blockers.map((blocker, index) => <li key={index}>{blocker.name}: {blocker.label}</li>)}
        </ul>}
      </div>;
    })}
  </div>;
}
