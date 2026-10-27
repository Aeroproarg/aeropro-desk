export type NasEntry = {
  equipmentId: string;
  itemName: string;
  operatorId: string;
  operatorName: string;
  folderName: string;
};

export type NasDownload = {
  plan_id: string;
  equipment_id: string;
  confirmed_at: string;
  confirmed_by: string;
  confirmed_by_name: string;
};

export function folderProgress(
  entries: Pick<NasEntry, "equipmentId">[],
  downloads: Pick<NasDownload, "equipment_id">[],
) {
  const folders = new Set(entries.map(entry => entry.equipmentId));
  const confirmed = new Set(downloads.map(download => download.equipment_id));
  return {
    total: folders.size,
    completed: [...folders].filter(id => confirmed.has(id)).length,
  };
}

export function materialReadiness(state: string, progress: { total: number; completed: number }) {
  const ready = state === "READY" && progress.total > 0 && progress.completed === progress.total;
  const label = ready ? "Disponible para edición"
    : progress.total === 0 ? "Sin carpetas preparadas"
    : progress.completed < progress.total ? `Material pendiente: ${progress.completed} de ${progress.total} carpetas descargadas`
    : "Esperando confirmación de carpetas del NAS";
  return { ready, label };
}

export type NasJobSource = {
  productionId: string;
  name: string;
  plan: {
    state: string;
    entries: Pick<NasEntry, "equipmentId">[];
    downloads: Pick<NasDownload, "equipment_id">[];
  } | null;
};

// Explica la cola de Edición de un trabajo. El estado de las piezas lo decide la base;
// las carpetas solo se usan para mostrar qué producción podría estar frenando.
export function jobEditingSummary(statuses: string[], sources: NasJobSource[], currentProductionId: string) {
  const ready = statuses.filter(status => status === "READY_POST").length;
  const waiting = statuses.filter(status => status === "DEFINED" || status === "PENDING_MATERIAL").length;
  const blockers = sources
    .filter(source => source.productionId !== currentProductionId)
    .map(source => {
      if (!source.plan) return { name: source.name, label: "sin carpeta NAS visible" };
      const material = materialReadiness(source.plan.state, folderProgress(source.plan.entries, source.plan.downloads));
      return material.ready ? null : { name: source.name, label: material.label };
    })
    .filter((blocker): blocker is { name: string; label: string } => blocker !== null);
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  if (statuses.length === 0) {
    return { tone: "warn" as const, message: "No tiene entregables cargados: no va a aparecer ninguna pieza en Edición.", blockers: [] };
  }
  if (ready > 0) {
    return { tone: "ok" as const, message: `${plural(ready, "pieza lista", "piezas listas")} para edición.`, blockers: [] };
  }
  if (waiting > 0) {
    return {
      tone: "warn" as const,
      message: blockers.length > 0
        ? `${plural(waiting, "pieza espera", "piezas esperan")} material de otras producciones del trabajo:`
        : `${plural(waiting, "pieza todavía no está habilitada", "piezas todavía no están habilitadas")}. Refrescá la página; si sigue igual, revisá los vínculos del trabajo.`,
      blockers,
    };
  }
  return { tone: "info" as const, message: "Sin piezas por comenzar: las de este trabajo ya están en edición, revisión o entregadas.", blockers: [] };
}
