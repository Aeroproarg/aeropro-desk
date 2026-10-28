"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Plus, Save, Trash2, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EVENT_STATUSES, EVENT_TYPES, fromLocalInput, toLocalInput } from "../calendar-utils";

// Formulario de reunión/evento (crear y editar). Al guardar, la plataforma lo copia sola a Google Calendar.

type Option = { id: string; name: string; parent?: string | null };
type External = { id?: string; name: string; email: string; company: string };

export type EventData = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  start_at: string;
  end_at: string;
  location: string | null;
  description: string | null;
  project_id: string | null;
  job_id: string | null;
  production_id: string | null;
  participants: { id: string; user_id: string | null; external_name: string | null; external_email: string | null; external_company: string | null }[];
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD] disabled:opacity-60";

function addHour(local: string) {
  if (!local) return "";
  return toLocalInput(new Date(new Date(fromLocalInput(local)).getTime() + 3600_000).toISOString());
}

export function EventForm({
  event, defaultDate, canEdit, people, projects, jobs, productions,
}: {
  event?: EventData;
  defaultDate?: string;
  canEdit: boolean;
  people: Option[];
  projects: Option[];
  jobs: Option[];
  productions: Option[];
}) {
  const router = useRouter();
  const initialStart = event ? toLocalInput(event.start_at) : defaultDate ? `${defaultDate}T10:00` : "";
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState(event?.event_type ?? "MEETING");
  const [status, setStatus] = useState(event?.status ?? "SCHEDULED");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(event ? toLocalInput(event.end_at) : addHour(initialStart));
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [projectId, setProjectId] = useState(event?.project_id ?? "");
  const [jobId, setJobId] = useState(event?.job_id ?? "");
  const [productionId, setProductionId] = useState(event?.production_id ?? "");
  const [internal, setInternal] = useState<string[]>(
    event?.participants.filter((p) => p.user_id).map((p) => p.user_id as string) ?? []
  );
  const [externals, setExternals] = useState<External[]>(
    event?.participants.filter((p) => !p.user_id).map((p) => ({
      id: p.id, name: p.external_name ?? "", email: p.external_email ?? "", company: p.external_company ?? "",
    })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const visibleJobs = useMemo(() => (projectId ? jobs.filter((j) => j.parent === projectId) : jobs), [jobs, projectId]);

  function changeStart(value: string) {
    // Si el final quedaba antes del nuevo inicio, se corre a una hora después.
    setStart(value);
    if (!end || end <= value) setEnd(addHour(value));
  }

  function togglePerson(id: string) {
    setInternal((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !canEdit) return;
    setErrorMessage("");
    if (!title.trim()) return setErrorMessage("Poné un título.");
    if (!start || !end) return setErrorMessage("Completá el inicio y el final.");
    if (end < start) return setErrorMessage("El final no puede ser antes del inicio.");
    const cleanExternals = externals.filter((x) => x.name.trim() || x.email.trim() || x.company.trim());
    if (cleanExternals.some((x) => !x.name.trim())) return setErrorMessage("Cada participante externo necesita un nombre.");

    setSaving(true);
    const supabase = createClient();
    const fields = {
      title: title.trim(),
      event_type: eventType,
      status,
      start_at: fromLocalInput(start),
      end_at: fromLocalInput(end),
      location: location.trim() || null,
      description: description.trim() || null,
      project_id: projectId || null,
      job_id: jobId || null,
      production_id: productionId || null,
    };

    try {
      let eventId = event?.id;
      if (eventId) {
        const { error } = await supabase.from("events").update(fields).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("events").insert({ ...fields, created_by_user_id: user?.id ?? null }).select("id").single();
        if (error) throw error;
        eventId = data.id as string;
      }

      // Participantes: solo se agregan, cambian o quitan los que cambiaron (así la Actividad queda clara).
      const before = event?.participants ?? [];
      const removed = before.filter((p) =>
        p.user_id ? !internal.includes(p.user_id) : !cleanExternals.some((x) => x.id === p.id)
      );
      if (removed.length) {
        const { error } = await supabase.from("event_participants").delete().in("id", removed.map((p) => p.id));
        if (error) throw error;
      }
      const newRows = [
        ...internal.filter((uid) => !before.some((p) => p.user_id === uid)).map((uid) => ({ event_id: eventId, user_id: uid })),
        ...cleanExternals.filter((x) => !x.id).map((x) => ({
          event_id: eventId, external_name: x.name.trim(), external_email: x.email.trim() || null, external_company: x.company.trim() || null,
        })),
      ];
      if (newRows.length) {
        const { error } = await supabase.from("event_participants").insert(newRows);
        if (error) throw error;
      }
      for (const x of cleanExternals.filter((x) => x.id)) {
        const old = before.find((p) => p.id === x.id);
        const next = { external_name: x.name.trim(), external_email: x.email.trim() || null, external_company: x.company.trim() || null };
        if (old && (old.external_name !== next.external_name || old.external_email !== next.external_email || old.external_company !== next.external_company)) {
          const { error } = await supabase.from("event_participants").update(next).eq("id", x.id!);
          if (error) throw error;
        }
      }

      router.push("/calendario?mes=" + start.slice(0, 7));
      router.refresh();
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      setErrorMessage(message.includes("row-level security") ? "No tenés permiso para editar el calendario." : `No se pudo guardar. ${message}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event || !canEdit) return;
    if (!window.confirm(`¿Borrar "${event.title}"? También se borra de Google Calendar. Si solo no se hizo, mejor marcala como Cancelada.`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error: partError } = await supabase.from("event_participants").delete().eq("event_id", event.id);
    const { error } = partError ? { error: partError } : await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      setErrorMessage(`No se pudo borrar. ${error.message}`);
      setSaving(false);
      return;
    }
    router.push("/calendario");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <Link href="/calendario" className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
          <ArrowLeft size={16} /> Volver al Calendario
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <CalendarPlus size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{event ? (canEdit ? "Editar reunión" : event.title) : "Nueva reunión"}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {canEdit ? "Se copia sola al Google Calendar del equipo." : "Solo lectura: tu rol no puede modificar el calendario."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <fieldset disabled={!canEdit || saving} className="space-y-7 p-6">
            <Field label="Título" required>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Reunión de preproducción con Sinergia" className={inputClass} />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Tipo">
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass}>
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Estado">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                  {EVENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Empieza" required>
                <input type="datetime-local" value={start} onChange={(e) => changeStart(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Termina" required>
                <input type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <Field label="Lugar o link" hint="Dirección, oficina o link de Meet/Zoom.">
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
            </Field>

            <Field label="Descripción">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
            </Field>

            <div className="grid gap-6 md:grid-cols-3">
              <Field label="Proyecto">
                <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setJobId(""); }} className={inputClass}>
                  <option value="">Ninguno</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Trabajo">
                <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
                  <option value="">Ninguno</option>
                  {visibleJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </Field>
              <Field label="Producción">
                <select value={productionId} onChange={(e) => setProductionId(e.target.value)} className={inputClass}>
                  <option value="">Ninguna</option>
                  {productions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Participantes del equipo">
              <div className="grid gap-2 sm:grid-cols-2">
                {people.map((person) => (
                  <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.02]">
                    <input type="checkbox" checked={internal.includes(person.id)} onChange={() => togglePerson(person.id)} />
                    {person.name}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Participantes externos" hint="Cliente, proveedores, etc. Quedan anotados en la descripción del evento de Google.">
              <div className="space-y-2">
                {externals.map((x, index) => (
                  <div key={x.id ?? `new-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {(["name", "email", "company"] as const).map((field) => (
                      <input key={field} type={field === "email" ? "email" : "text"} value={x[field]}
                        placeholder={field === "name" ? "Nombre" : field === "email" ? "Mail (opcional)" : "Empresa (opcional)"}
                        onChange={(e) => setExternals((list) => list.map((item, i) => (i === index ? { ...item, [field]: e.target.value } : item)))}
                        className={inputClass} />
                    ))}
                    <button type="button" aria-label="Quitar" onClick={() => setExternals((list) => list.filter((_, i) => i !== index))}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setExternals((list) => [...list, { name: "", email: "", company: "" }])}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
                  <Plus size={15} /> Agregar externo
                </button>
              </div>
            </Field>

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{errorMessage}</div>
            )}
          </fieldset>

          {canEdit && (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#080A0C] px-6 py-4">
              {event ? (
                <button type="button" onClick={handleDelete} disabled={saving}
                  className="flex h-10 items-center gap-2 rounded-lg border border-red-900/50 px-3 text-sm text-red-300 transition hover:bg-red-950/30 disabled:opacity-50">
                  <Trash2 size={15} /> Borrar
                </button>
              ) : <p className="text-xs text-zinc-700">* Campos obligatorios</p>}
              <div className="flex gap-3">
                <Link href="/calendario" className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
                  Cancelar
                </Link>
                <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-[#20A4DD]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}
