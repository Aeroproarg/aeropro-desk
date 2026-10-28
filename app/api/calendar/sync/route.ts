import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  deleteCalendarEvent,
  googleCalendarConfigured,
  upsertCalendarEvent,
} from "@/utils/google-calendar";

// Procesa los pedidos de sincronización (producciones y reuniones) hacia Google Calendar.
// Lo llama Supabase en cada cambio (con CALENDAR_SYNC_SECRET) o una persona desde Calendario ("Sincronizar ahora").

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aeroprodesk.netlify.app";
const MAX_ENTITIES = 15; // por llamada, para no pasar el tiempo límite del servidor
const CLOSED_PRODUCTION = ["CANCELLED", "NOT_COMPLETED"];

const EVENT_TYPES: Record<string, string> = {
  MEETING: "Reunión interna",
  CLIENT_MEETING: "Reunión con cliente",
  VISIT: "Visita / scouting",
  OTHER: "Evento",
};

type Row = Record<string, any>;

function name(relation: unknown, field = "name"): string | undefined {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value && typeof value === "object" ? ((value as Row)[field] ?? undefined) : undefined;
}

function secretMatches(received: string | null) {
  const expected = process.env.CALENDAR_SYNC_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorized(request: Request) {
  if (secretMatches(request.headers.get("x-calendar-sync-secret"))) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("can_edit_calendar");
  return data === true;
}

async function syncProduction(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: p } = await admin
    .from("productions")
    .select("id,name,status,start_at,end_at,location,description,responsible:responsible_user_id ( full_name ),production_jobs ( jobs:job_id ( name, projects:project_id ( name, clients:client_id ( name ) ) ) )")
    .eq("id", id)
    .maybeSingle();

  if (!p || !p.start_at || CLOSED_PRODUCTION.includes(p.status)) {
    await deleteCalendarEvent("production", id);
    if (p) await admin.from("productions").update({ google_event_id: null, google_synced_at: new Date().toISOString() }).eq("id", id);
    return;
  }

  const jobs = ((p.production_jobs ?? []) as Row[])
    .map((link) => (Array.isArray(link.jobs) ? link.jobs[0] : link.jobs))
    .filter(Boolean);
  const jobLines = jobs.map((job: Row) => {
    const project = Array.isArray(job.projects) ? job.projects[0] : job.projects;
    return `• ${job.name}${project ? ` (${[project.name, name(project.clients)].filter(Boolean).join(" · ")})` : ""}`;
  });
  const start = new Date(p.start_at);
  const end = p.end_at && new Date(p.end_at) > start ? new Date(p.end_at) : new Date(start.getTime() + 2 * 3600_000);

  const googleId = await upsertCalendarEvent({
    kind: "production",
    platformId: id,
    summary: `🎬 ${p.name}`,
    location: p.location,
    start: start.toISOString(),
    end: end.toISOString(),
    colorId: "7",
    description: [
      "Rodaje · AeroPro Desk",
      name(p.responsible, "full_name") ? `Responsable: ${name(p.responsible, "full_name")}` : null,
      jobLines.length ? `Trabajos:\n${jobLines.join("\n")}` : null,
      p.description ? `\n${p.description}` : null,
      `\nVer en la plataforma: ${SITE_URL}/producciones/${id}`,
    ].filter(Boolean).join("\n"),
  });
  await admin.from("productions").update({ google_event_id: googleId, google_synced_at: new Date().toISOString() }).eq("id", id);
}

async function syncEvent(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: e } = await admin
    .from("events")
    .select("id,title,event_type,status,start_at,end_at,location,description,projects:project_id ( name ),productions:production_id ( name ),event_participants ( external_name, external_company, profiles:user_id ( full_name ) )")
    .eq("id", id)
    .maybeSingle();

  if (!e || e.status === "CANCELLED") {
    await deleteCalendarEvent("event", id);
    if (e) await admin.from("events").update({ google_event_id: null, google_synced_at: new Date().toISOString() }).eq("id", id);
    return;
  }

  const people = ((e.event_participants ?? []) as Row[]).map((participant) =>
    name(participant.profiles, "full_name") ??
    [participant.external_name, participant.external_company].filter(Boolean).join(" · ")
  ).filter(Boolean);

  const googleId = await upsertCalendarEvent({
    kind: "event",
    platformId: id,
    summary: e.title,
    location: e.location,
    start: new Date(e.start_at).toISOString(),
    end: new Date(e.end_at).toISOString(),
    colorId: e.event_type === "CLIENT_MEETING" ? "3" : "5",
    description: [
      `${EVENT_TYPES[e.event_type] ?? "Evento"} · AeroPro Desk`,
      e.status === "DONE" ? "Estado: realizado" : null,
      name(e.projects) ? `Proyecto: ${name(e.projects)}` : null,
      name(e.productions) ? `Producción: ${name(e.productions)}` : null,
      people.length ? `Participantes: ${people.join(", ")}` : null,
      e.description ? `\n${e.description}` : null,
      `\nVer en la plataforma: ${SITE_URL}/calendario/eventos/${id}`,
    ].filter(Boolean).join("\n"),
  });
  await admin.from("events").update({
    google_event_id: googleId,
    google_calendar_id: process.env.GOOGLE_CALENDAR_ID,
    google_synced_at: new Date().toISOString(),
  }).eq("id", id);
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!googleCalendarConfigured()) {
    return NextResponse.json({ error: "Google Calendar todavía no está configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("calendar_sync_queue")
    .select("id,entity_type,entity_id,attempts")
    .is("processed_at", null)
    .order("id", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: "No se pudo leer la cola de sincronización." }, { status: 500 });

  // Varios pedidos del mismo registro se resuelven con una sola sincronización (con su estado actual).
  type Group = { kind: "production" | "event"; id: string; rows: number[]; attempts: number };
  const groups = new Map<string, Group>();
  for (const row of (pending ?? []) as Row[]) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const group: Group = groups.get(key) ?? { kind: row.entity_type, id: String(row.entity_id), rows: [], attempts: 0 };
    group.rows.push(Number(row.id));
    group.attempts = Math.max(group.attempts, Number(row.attempts) || 0);
    groups.set(key, group);
  }

  let processed = 0;
  let failed = 0;
  for (const group of [...groups.values()].slice(0, MAX_ENTITIES)) {
    try {
      if (group.kind === "production") await syncProduction(admin, group.id);
      else await syncEvent(admin, group.id);
      await admin.from("calendar_sync_queue").update({ processed_at: new Date().toISOString(), last_error: null }).in("id", group.rows);
      processed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Error desconocido";
      await admin.from("calendar_sync_queue")
        .update({ attempts: group.attempts + 1, last_error: message.slice(0, 500) })
        .in("id", group.rows);
    }
  }

  return NextResponse.json({ processed, failed, remaining: Math.max(groups.size - MAX_ENTITIES, 0) });
}
