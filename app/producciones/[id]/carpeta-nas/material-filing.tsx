"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Paso final del material: confirmar que se acomodó en la carpeta del cliente y anotar dónde.
// La plataforma no mueve archivos: solo registra quién confirmó, cuándo y la ruta.

const supabase = createClient();

export type MaterialFilingRecord = {
  plan_id: string;
  filed_path: string;
  filed_at: string;
  filed_by_name: string;
  path_updated_at: string | null;
  path_updated_by_name: string | null;
};

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
});

export default function MaterialFiling({ planId, ready, disabled }: { planId: string; ready: boolean; disabled: boolean }) {
  const router = useRouter();
  const [filing, setFiling] = useState<MaterialFilingRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("nas_material_filings")
        .select("plan_id,filed_path,filed_at,filed_by_name,path_updated_at,path_updated_by_name")
        .eq("plan_id", planId).maybeSingle();
      if (cancelled) return;
      if (error) setUnavailable(true);
      else setFiling(data as MaterialFilingRecord | null);
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, [planId]);

  async function save() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const { data, error } = await supabase.rpc("confirm_nas_material_filing", { p_plan_id: planId, p_path: path });
      if (error) throw error;
      const record = data as MaterialFilingRecord;
      if (!record?.filed_path) throw new Error("No se recibió la confirmación. Actualizá la página antes de reintentar.");
      setFiling(record);
      setEditing(false);
      router.refresh();
    } catch (err: unknown) {
      setError(typeof err === "object" && err !== null && "message" in err ? String(err.message) : "No se pudo guardar. Podés reintentar.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPath() {
    if (!filing) return;
    try {
      await navigator.clipboard.writeText(filing.filed_path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* el navegador no permitió copiar: la ruta queda visible para copiarla a mano */ }
  }

  if (!loaded) return <p className="text-sm text-zinc-500">Consultando material acomodado…</p>;
  if (unavailable) return null; // La actualización de la base todavía no está instalada.

  const form = <div className="space-y-2">
    <label className="block text-sm text-zinc-300" htmlFor="filed-path">Carpeta donde quedó el material</label>
    <input
      id="filed-path"
      type="text"
      value={path}
      onChange={(e) => setPath(e.target.value)}
      placeholder="\\NAS\Clientes\Cliente\2026\Producción"
      className="w-full rounded-lg border border-white/10 bg-[#050607] px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-700"
    />
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={save} disabled={disabled || saving || path.trim().length < 3}
        className="rounded-lg border border-cyan-800 bg-cyan-950 px-3 py-2 text-sm text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
        {saving ? "Guardando…" : filing ? "Guardar ruta corregida" : "Confirmar material acomodado"}
      </button>
      {filing && <button type="button" onClick={() => { setEditing(false); setError(""); }}
        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400">Cancelar</button>}
    </div>
  </div>;

  return <div className="space-y-3 border-t border-white/10 pt-4">
    <div>
      <h3 className="font-semibold">Acomodar en la carpeta del cliente</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Después de descargar, el material se acomoda a mano en la carpeta del cliente. Confirmalo acá y anotá dónde quedó.
      </p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-900 p-3 text-sm text-red-300">{error}</p>}
    {filing ? <div className="space-y-2">
      <p className="text-sm font-medium text-emerald-300">Material acomodado</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-white/[0.04] px-2 py-1 text-sm text-zinc-200">{filing.filed_path}</code>
        <button type="button" onClick={copyPath} className="text-xs text-cyan-400 hover:underline">{copied ? "Copiada" : "Copiar ruta"}</button>
      </div>
      <p className="text-xs text-zinc-400">Confirmó {filing.filed_by_name} · {dateFormat.format(new Date(filing.filed_at))} (hora de Argentina)</p>
      {filing.path_updated_at && <p className="text-xs text-zinc-500">
        Ruta corregida por {filing.path_updated_by_name} · {dateFormat.format(new Date(filing.path_updated_at))}
      </p>}
      {editing ? form : <button type="button" disabled={disabled}
        onClick={() => { setPath(filing.filed_path); setEditing(true); }}
        className="text-xs text-cyan-400 hover:underline disabled:opacity-40">Corregir ruta</button>}
    </div> : ready ? form : <p className="text-sm text-amber-200">
      Disponible cuando todas las carpetas estén descargadas.
    </p>}
  </div>;
}
