import type { createClient } from "@/utils/supabase/server";
import type { RelatedRow } from "@/app/related-records";
import { relationField } from "@/app/related-records";
import { CLOSED_STATUSES, statusLabel } from "@/utils/status-labels";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, any>;

const byOpenFirst = (a: RelatedRow, b: RelatedRow) => Number(a.closed ?? false) - Number(b.closed ?? false);

export function jobRows(jobs: Row[], projectNames?: Map<string, string>): RelatedRow[] {
  return jobs
    .map((job) => ({
      key: job.id,
      href: `/trabajos/${job.id}`,
      title: job.name,
      subtitle: [projectNames?.get(job.project_id), relationField(job.profiles, "full_name")].filter(Boolean).join(" · ") || undefined,
      status: statusLabel("job", job.status),
      closed: CLOSED_STATUSES.job.includes(job.status),
      date: job.general_deadline,
      dateLabel: "vence",
    }))
    .sort(byOpenFirst);
}

export function requestRows(requests: Row[]): RelatedRow[] {
  return requests
    .map((request) => ({
      key: request.id,
      href: `/solicitudes/${request.id}`,
      title: request.title,
      status: statusLabel("request", request.status),
      closed: CLOSED_STATUSES.request.includes(request.status),
      date: request.created_at,
      dateLabel: "creada",
    }))
    .sort(byOpenFirst);
}

// Piezas y producciones de un conjunto de trabajos (las producciones se vinculan por production_jobs).
export async function loadJobRelations(supabase: Supabase, jobs: Row[]) {
  const jobIds = jobs.map((job) => job.id as string);
  if (jobIds.length === 0) return { pieceRows: [] as RelatedRow[], productionRows: [] as RelatedRow[], error: false };

  const jobNames = new Map(jobs.map((job) => [job.id as string, job.name as string]));
  const [piecesResult, linksResult] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id,job_id,name,status,deadline")
      .in("job_id", jobIds)
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("production_jobs")
      .select("production_id, productions:production_id ( id, name, status, start_at, location )")
      .in("job_id", jobIds),
  ]);

  const pieceRows: RelatedRow[] = ((piecesResult.data ?? []) as Row[])
    .map((piece) => ({
      key: piece.id,
      href: `/trabajos/${piece.job_id}/entregables/${piece.id}`,
      title: piece.name,
      subtitle: jobNames.get(piece.job_id),
      status: statusLabel("piece", piece.status),
      closed: CLOSED_STATUSES.piece.includes(piece.status),
      date: piece.deadline,
      dateLabel: "vence",
    }))
    .sort(byOpenFirst);

  const productions = new Map<string, Row>();
  for (const link of (linksResult.data ?? []) as Row[]) {
    const production = Array.isArray(link.productions) ? link.productions[0] : link.productions;
    if (production?.id) productions.set(production.id, production);
  }
  const productionRows: RelatedRow[] = [...productions.values()]
    .sort((a, b) => String(b.start_at ?? "").localeCompare(String(a.start_at ?? "")))
    .map((production) => ({
      key: production.id,
      href: `/producciones/${production.id}`,
      title: production.name,
      subtitle: production.location ?? undefined,
      status: statusLabel("production", production.status),
      closed: CLOSED_STATUSES.production.includes(production.status),
      date: production.start_at,
    }));

  return { pieceRows, productionRows, error: Boolean(piecesResult.error || linksResult.error) };
}
