import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { statusLabel } from "@/utils/status-labels";
import { AR_OFFSET, argentinaDay, argentinaTime, eventTypeLabel } from "./calendar-utils";
import { SyncButton } from "./sync-button";

// Calendario del equipo: producciones (rodajes) y reuniones/eventos. Se copia al Google Calendar compartido.

type Entry = { key: string; day: string; start: string; title: string; href: string; kind: "production" | "event"; detail: string; muted: boolean };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseMonth(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return { year: Number(match[1]), month: Number(match[2]) };
  const [year, month] = argentinaDay(new Date()).split("-").map(Number);
  return { year, month };
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (year: number, month: number) => {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { year, month } = parseMonth(mes);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Grilla de lunes a domingo que cubre el mes completo.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - lead * 86400_000);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const days = Array.from({ length: totalCells }, (_, i) => new Date(gridStart.getTime() + i * 86400_000).toISOString().slice(0, 10));
  const rangeStart = `${days[0]}T00:00:00${AR_OFFSET}`;
  const rangeEnd = new Date(new Date(`${days[days.length - 1]}T00:00:00${AR_OFFSET}`).getTime() + 86400_000).toISOString();

  const [productionsResult, eventsResult, canEditResult, syncResult] = await Promise.all([
    supabase.from("productions").select("id,name,status,start_at,location").gte("start_at", rangeStart).lt("start_at", rangeEnd).order("start_at"),
    supabase.from("events").select("id,title,event_type,status,start_at,location").gte("start_at", rangeStart).lt("start_at", rangeEnd).order("start_at"),
    supabase.rpc("can_edit_calendar"),
    supabase.rpc("calendar_sync_status"),
  ]);
  const canEdit = canEditResult.data === true;
  const sync = (syncResult.data ?? null) as { pending: number; last_error: string | null; last_sync: string | null } | null;

  const entries: Entry[] = [
    ...(productionsResult.data ?? []).map((p) => ({
      key: `p${p.id}`, day: argentinaDay(p.start_at), start: p.start_at, title: p.name, href: `/producciones/${p.id}`,
      kind: "production" as const, detail: [statusLabel("production", p.status), p.location].filter(Boolean).join(" · "),
      muted: ["CANCELLED", "NOT_COMPLETED"].includes(p.status),
    })),
    ...(eventsResult.data ?? []).map((e) => ({
      key: `e${e.id}`, day: argentinaDay(e.start_at), start: e.start_at, title: e.title, href: `/calendario/eventos/${e.id}`,
      kind: "event" as const, detail: [eventTypeLabel(e.event_type), e.location].filter(Boolean).join(" · "),
      muted: e.status === "CANCELLED",
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  const today = argentinaDay(new Date());
  const currentMonth = `${year}-${pad(month)}`;
  const upcoming = entries.filter((e) => e.day >= (today.startsWith(currentMonth) ? today : `${currentMonth}-01`) && e.day.startsWith(currentMonth) && !e.muted);

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <CalendarDays size={21} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
              <p className="mt-1 text-sm text-zinc-500">Producciones y reuniones. Se copian al Google Calendar del equipo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && <SyncButton />}
            {canEdit && (
              <Link href="/calendario/eventos/nuevo" className="flex h-9 items-center gap-2 rounded-lg bg-[#20A4DD] px-3 text-sm font-semibold text-black transition hover:brightness-110">
                <Plus size={16} /> Nueva reunión
              </Link>
            )}
          </div>
        </div>

        {sync && (sync.pending > 0 || sync.last_error) && (
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${sync.last_error ? "border-amber-900/50 bg-amber-950/20 text-amber-200" : "border-white/10 bg-[#0B0F12] text-zinc-400"}`}>
            {sync.pending > 0 && <p>{sync.pending === 1 ? "1 cambio esperando" : `${sync.pending} cambios esperando`} para copiarse a Google Calendar.</p>}
            {sync.last_error && <p className="mt-1 text-xs">Último error: {sync.last_error}</p>}
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <Link href={`/calendario?mes=${monthKey(year, month - 1)}`} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white">
            <ChevronLeft size={17} />
          </Link>
          <Link href={`/calendario?mes=${monthKey(year, month + 1)}`} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white">
            <ChevronRight size={17} />
          </Link>
          <h2 className="ml-2 text-lg font-semibold">{MONTHS[month - 1]} {year}</h2>
          {!today.startsWith(currentMonth) && (
            <Link href="/calendario" className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white">Hoy</Link>
          )}
          <span className="ml-auto hidden items-center gap-4 text-xs text-zinc-500 sm:flex">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#20A4DD]" /> Producción</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Reunión / evento</span>
          </span>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12] md:block">
          <div className="grid grid-cols-7 border-b border-white/10">
            {WEEKDAYS.map((d) => <div key={d} className="px-3 py-2 text-xs font-medium text-zinc-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.startsWith(currentMonth);
              const items = byDay.get(day) ?? [];
              return (
                <div key={day} className={`min-h-[118px] border-b border-r border-white/5 p-2 ${inMonth ? "" : "bg-black/20"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${day === today ? "bg-[#20A4DD] font-semibold text-black" : inMonth ? "text-zinc-300" : "text-zinc-700"}`}>
                      {Number(day.slice(8))}
                    </span>
                    {canEdit && inMonth && (
                      <Link href={`/calendario/eventos/nuevo?fecha=${day}`} aria-label={`Nueva reunión el ${day}`} className="text-zinc-700 hover:text-[#45B8E8]">
                        <Plus size={14} />
                      </Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Link key={item.key} href={item.href} title={`${item.title}${item.detail ? ` · ${item.detail}` : ""}`}
                        className={`block truncate rounded px-1.5 py-1 text-[11px] leading-tight ${item.kind === "production" ? "bg-[#20A4DD]/15 text-[#7FD0F2] hover:bg-[#20A4DD]/25" : "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25"} ${item.muted ? "line-through opacity-50" : ""}`}>
                        <span className="opacity-70">{argentinaTime(item.start)}</span> {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* En el celular: lista del mes */}
        <div className="md:hidden">
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-[#0B0F12] p-5 text-sm text-zinc-500">No hay nada agendado en lo que queda del mes.</p>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
              {upcoming.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex gap-3 px-4 py-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${item.kind === "production" ? "bg-[#20A4DD]" : "bg-amber-400"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-200">{item.title}</span>
                      <span className="block text-xs text-zinc-500">
                        {new Date(item.start).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {sync?.last_sync && (
          <p className="mt-4 text-xs text-zinc-600">
            Última copia a Google: {new Date(sync.last_sync).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}
          </p>
        )}
      </div>
    </main>
  );
}
