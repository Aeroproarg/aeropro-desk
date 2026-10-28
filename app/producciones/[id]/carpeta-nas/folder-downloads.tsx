"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { folderProgress, materialReadiness, type NasDownload, type NasEntry } from "@/utils/nas-downloads";
import MaterialFiling from "./material-filing";

const supabase = createClient();
type Plan = { id: string; entries: NasEntry[]; state: string };
const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
});

export default function FolderDownloads({ plan, disabled }: { plan: Plan; disabled: boolean }) {
  const router = useRouter();
  const [downloads, setDownloads] = useState<NasDownload[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pendingRequest = useRef(false);
  const readVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = ++readVersion.current;
    async function load() {
      try {
        const { data, error } = await supabase.from("nas_folder_downloads")
          .select("plan_id,equipment_id,confirmed_at,confirmed_by,confirmed_by_name").eq("plan_id", plan.id);
        if (cancelled || version !== readVersion.current) return;
        if (error) throw error;
        setDownloads((data ?? []) as NasDownload[]);
        setError("");
      } catch {
        if (cancelled || version !== readVersion.current) return;
        setDownloads(null);
        setError("No se pudo consultar el avance de las descargas. Tocá Actualizar estado para reintentar.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [plan]);

  async function confirm(entry: NasEntry) {
    if (pendingRequest.current) return;
    pendingRequest.current = true;
    ++readVersion.current; // Una lectura anterior no puede borrar una confirmación nueva.
    setSaving(entry.equipmentId); setError(""); setNotice("");
    try {
      const { data, error } = await supabase.rpc("confirm_nas_folder_download", {
        p_plan_id: plan.id, p_equipment_id: entry.equipmentId,
      });
      if (error) throw error;
      const record = data as NasDownload;
      if (!record || record.plan_id !== plan.id || record.equipment_id !== entry.equipmentId || !record.confirmed_at) {
        throw new Error("No se recibió la confirmación. Actualizá el estado antes de reintentar.");
      }
      ++readVersion.current;
      setDownloads(current => [...(current ?? []).filter(row => row.equipment_id !== record.equipment_id), record]);
      setNotice(`Descarga terminada: ${entry.folderName}.`);
      router.refresh();
    } catch (err: unknown) {
      setError(typeof err === "object" && err !== null && "message" in err
        ? String(err.message) : "No se pudo confirmar la descarga. Podés reintentar sin duplicar el registro.");
    } finally {
      pendingRequest.current = false;
      setSaving(null);
    }
  }

  const progress = downloads ? folderProgress(plan.entries, downloads) : null;
  const material = progress ? materialReadiness(plan.state, progress) : null;
  return <div className="space-y-4 border-t border-white/10 pt-4">
    <div>
      <h3 className="font-semibold">Descargas por carpeta</h3>
      <p className="mt-1 text-sm text-zinc-300" aria-live="polite">
        {progress ? `${progress.completed} de ${progress.total} carpetas descargadas` : error ? "Avance no disponible" : "Consultando descargas…"}
      </p>
      {material && <p className={`mt-2 text-sm ${material.ready ? "text-emerald-300" : "text-amber-200"}`} role="status">{material.label}</p>}
      {material?.ready && <p className="mt-2 text-sm text-zinc-400">El material de esta producción está disponible. Las piezas del trabajo pasarán a listas cuando todas sus producciones estén completas. <Link href="/edicion" className="text-cyan-400 underline">Ir a Edición</Link></p>}
      <p className="mt-2 text-sm text-zinc-400">Marcá cada carpeta cuando haya terminado la copia de todo su material. Se registra tu usuario y la hora de confirmación.</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-900 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
    <ul className="divide-y divide-white/10">{plan.entries.map(entry => {
      const record = downloads?.find(row => row.equipment_id === entry.equipmentId);
      return <li key={entry.equipmentId} className="space-y-2 py-4">
        <p className="break-all font-mono text-sm">{entry.folderName}</p>
        <p className="text-xs text-zinc-400">Operador: {entry.operatorName}</p>
        {record ? <div className="space-y-1">
          <p className="text-sm font-medium text-emerald-300">Descarga terminada</p>
          <p className="text-xs text-zinc-400">Confirmó {record.confirmed_by_name} · {dateFormat.format(new Date(record.confirmed_at))} (hora de Argentina)</p>
        </div> : <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-zinc-400">{downloads ? "Pendiente" : "Sin consultar"}</span>
          <button type="button" disabled={disabled || saving !== null || downloads === null || plan.state !== "READY"}
            onClick={() => confirm(entry)}
            aria-label={`Marcar descarga terminada: ${entry.folderName}`}
            className="rounded-lg border border-cyan-800 bg-cyan-950 px-3 py-2 text-sm text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
            {saving === entry.equipmentId ? "Guardando…" : "Marcar descarga terminada"}
          </button>
        </div>}
      </li>;
    })}</ul>
    {plan.state !== "READY" && <p className="text-sm text-amber-200">Esperá la confirmación de las carpetas del NAS y tocá Actualizar estado para habilitar las nuevas descargas.</p>}
    <p className="text-xs text-zinc-400">Es una confirmación manual de la copia; no verifica la integridad de los archivos.</p>
    <MaterialFiling planId={plan.id} ready={Boolean(material?.ready)} disabled={disabled} />
  </div>;
}
