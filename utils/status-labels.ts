// Nombres en castellano de los estados guardados en la base, por tipo de registro.
const JOB: Record<string, string> = {
  PENDING_PLANNING: "Pendiente planificación", IN_PLANNING: "En planificación", PLANNED: "Planificado",
  PAUSED: "Pausado", CANCELLED: "Cancelado", COMPLETED: "Completado", ARCHIVED: "Archivado",
};
const PIECE: Record<string, string> = {
  DEFINED: "Definida", PENDING_MATERIAL: "Pendiente material", READY_POST: "Lista para post",
  EDITING: "En edición", COORDINATOR_REVIEW: "Revisión coordinador", INTERNAL_REVIEW: "Revisión interna",
  CLIENT_REVIEW: "Revisión cliente", CORRECTIONS: "Correcciones", APPROVED: "Aprobada",
  DELIVERED: "Entregada", OUT_OF_SCOPE: "Fuera de alcance",
};
const PRODUCTION: Record<string, string> = {
  PENDING_DATE: "Pendiente fecha", PENDING_PLANNING: "Pendiente planificación", SCHEDULED: "Programada",
  READY: "Lista", COMPLETED: "Completada", NOT_COMPLETED: "No realizada", CANCELLED: "Cancelada",
};
const REQUEST: Record<string, string> = {
  NEW: "Nueva", IN_DEFINITION: "En definición", WAITING_CLIENT: "Esperando cliente", CONFIRMED: "Confirmada",
  POSTPONED: "Postergada", DID_NOT_ADVANCE: "No avanzó", CANCELLED: "Cancelada",
};
const PROJECT: Record<string, string> = { ACTIVE: "Activo", PAUSED: "Pausado", CLOSED: "Cerrado" };

const MAPS = { job: JOB, piece: PIECE, production: PRODUCTION, request: REQUEST, project: PROJECT };

export function statusLabel(kind: keyof typeof MAPS, status: string | null | undefined) {
  if (!status) return "Sin estado";
  return MAPS[kind][status] ?? status;
}

// Estados que ya no requieren trabajo (para mostrarlos atenuados o separarlos).
export const CLOSED_STATUSES: Record<keyof typeof MAPS, string[]> = {
  job: ["CANCELLED", "COMPLETED", "ARCHIVED"],
  piece: ["APPROVED", "DELIVERED", "OUT_OF_SCOPE"],
  production: ["COMPLETED", "NOT_COMPLETED", "CANCELLED"],
  request: ["CONFIRMED", "DID_NOT_ADVANCE", "CANCELLED"],
  project: ["CLOSED"],
};
