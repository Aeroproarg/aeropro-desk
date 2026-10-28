"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Fuerza el envío a Google Calendar de los cambios pendientes (normalmente se envían solos en segundos).
export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(result.error || "No se pudo sincronizar.");
      else if (result.failed) setMessage(`${result.failed} con error. Mirá el detalle abajo.`);
      else setMessage("Sincronizado.");
      router.refresh();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={sync} disabled={busy}
        className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50">
        <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        {busy ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </span>
  );
}
