"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();
type Person = { id: string; full_name: string };
type Equipment = { id: string; item_name: string; used_by_user_id: string | null; used_by: Person | Person[] | null };
type Entry = { equipmentId: string; itemName: string; operatorId: string; operatorName: string; folderName: string };
type Preview = { rootName: string; entries: Entry[]; snapshot: string; state: string; existing: boolean };
type Saved = { root_name: string; state: string; last_error: string | null; entries: Entry[] };

function operator(eq: Equipment) {
  return Array.isArray(eq.used_by) ? eq.used_by[0] : eq.used_by;
}

export default function NasFolderPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [prod, eq, plan] = await Promise.all([
        supabase.from("productions").select("name").eq("id", id).single(),
        supabase.from("production_equipment").select("id,item_name,used_by_user_id,used_by:used_by_user_id(id,full_name)")
          .eq("production_id", id).order("created_at"),
        supabase.from("nas_folder_plans").select("root_name,state,last_error,entries").eq("production_id", id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (prod.error || eq.error || plan.error) {
        setError("No se pudo cargar la preparación de carpetas. Verificá tu sesión y que la actualización de la base esté instalada.");
      } else {
        setName(prod.data.name);
        setEquipment((eq.data ?? []) as Equipment[]);
        setSaved(plan.data as Saved | null);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function refreshStatus() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.from("nas_folder_plans")
        .select("root_name,state,last_error,entries").eq("production_id", id).maybeSingle();
      if (error) throw error;
      setSaved(data as Saved | null);
    } catch { setError("No se pudo actualizar el estado. Intentá nuevamente."); }
    finally { setBusy(false); }
  }

  async function prepare(confirm: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error } = await supabase.rpc("prepare_nas_folders", {
        p_production_id: id, p_equipment_ids: selected,
        p_confirm: confirm, p_snapshot: confirm ? preview?.snapshot : null,
      });
      if (error) { setPreview(null); throw error; }
      const result = data as Preview;
      if (confirm) {
        setPreview(null);
        setMessage(result.state === "READY" ? "La carpeta ya está preparada. Podés reutilizarla." : "Solicitud guardada. El NAS la procesará en su próxima revisión.");
        const plan = await supabase.from("nas_folder_plans").select("root_name,state,last_error,entries").eq("production_id", id).single();
        if (!plan.error) setSaved(plan.data as Saved);
      } else setPreview(result);
    } catch (err: unknown) {
      setError(typeof err === "object" && err !== null && "message" in err ? String(err.message) : "No se pudo completar la solicitud.");
    } finally { setBusy(false); }
  }

  const button = "rounded-lg border border-cyan-800 bg-cyan-950 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40";
  return <main className="min-h-screen bg-[#050607] px-5 py-8 text-zinc-200">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/producciones/${id}`} className="text-sm text-cyan-400">← Volver a la producción</Link>
      <header><h1 className="text-2xl font-semibold">Preparar carpeta en NAS</h1><p className="mt-2 text-zinc-400">{name}</p></header>
      <p className="text-sm text-zinc-400">Seleccioná los equipos que generaron material. Usaremos el operador asignado en Equipamiento. Quien descarga se registra por separado en Material.</p>
      {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-cyan-900 p-4 text-cyan-200">{message}</p>}
      {loading ? <p>Cargando equipos…</p> : <>
        {saved && <section className="space-y-3 rounded-xl border border-white/10 bg-[#0B0F12] p-5">
          <h2 className="font-semibold">{saved.state === "READY" ? "Carpeta preparada" : saved.state === "ERROR" ? "Requiere revisión" : "Esperando al NAS"}</h2>
          <p className="break-all font-mono text-sm">Backup/{saved.root_name}</p>
          <p className="text-sm text-zinc-400">{saved.state === "READY" ? "Podés copiar el material desde Finder o el Explorador de Windows." : "El NAS consulta las solicitudes cada 5 minutos."}</p>
          {saved.last_error && <p role="alert" className="text-sm text-amber-300">{saved.last_error}</p>}
          <ul className="space-y-1 text-sm text-zinc-400">{saved.entries.map(e => <li key={e.equipmentId} className="break-all">{e.folderName}</li>)}</ul>
          <button type="button" className={button} disabled={busy} onClick={refreshStatus}>Actualizar estado</button>
        </section>}
        <section className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">
          <h2 className="mb-3 font-semibold">Equipos y operadores</h2>
          {!equipment.length && <p className="text-sm text-zinc-400">Todavía no hay equipamiento cargado.</p>}
          <div className="divide-y divide-white/10">{equipment.map(eq => {
            const person = operator(eq);
            return <label key={eq.id} className="flex cursor-pointer items-center gap-3 py-4">
              <input type="checkbox" disabled={busy || !person || !eq.item_name.trim()} checked={selected.includes(eq.id)}
                onChange={e => { setSelected(e.target.checked ? [...selected, eq.id] : selected.filter(x => x !== eq.id)); setPreview(null); setMessage(""); }} />
              <span><span className="block">{eq.item_name}</span><span className={`text-sm ${person ? "text-zinc-400" : "text-amber-300"}`}>{person?.full_name ?? "Falta asignar quién lo usa"}</span></span>
            </label>;
          })}</div>
          <Link className="mt-3 inline-block text-sm text-cyan-400" href={`/producciones/${id}/equipamiento`}>Revisar equipamiento y operadores →</Link>
        </section>
        <button type="button" className={button} disabled={busy || selected.length === 0} onClick={() => prepare(false)}>{busy ? "Procesando…" : "Ver vista previa"}</button>
        {preview && <section className="space-y-4 rounded-xl border border-cyan-900 p-5">
          <h2 className="font-semibold">Vista previa</h2>
          <p className="break-all font-mono text-sm">Backup/{preview.rootName}/</p>
          <ul className="space-y-2 text-sm">{preview.entries.map(entry => <li className="break-all font-mono" key={entry.equipmentId}>└ {entry.folderName}/</li>)}</ul>
          <p className="text-sm text-zinc-400">{preview.existing ? "Se reutilizará la carpeta de esta producción. Las carpetas existentes conservan su nombre." : "El código se reservará al confirmar. Si otra producción lo ocupa antes, te pediremos actualizar la vista previa."}</p>
          <button type="button" className={button} disabled={busy} onClick={() => prepare(true)}>Confirmar preparación</button>
        </section>}
      </>}
      <p className="text-sm text-amber-200/80">Preparar carpetas no confirma la descarga ni el backup. Al terminar de copiar y verificar el material, registralo en <Link className="underline" href={`/producciones/${id}/material`}>Material de la producción</Link>.</p>
    </div>
  </main>;
}
