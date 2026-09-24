"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  FileVideo2,
  Save,
  UserRound,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

type PieceData = {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
  responsible_user_id: string | null;
  editor_user_id: string | null;
  target_first_cut_at: string | null;
  actual_first_cut_at: string | null;
  current_version: number | null;
  final_url: string | null;
  urgent: boolean;
  properties: {
    format?: string | null;
    duration?: string | null;
    resolution?: string | null;
  } | null;
};

const STATUSES = [
  { value: "DEFINED", label: "Definido" },
  { value: "PENDING_MATERIAL", label: "Pendiente de material" },
  { value: "READY_POST", label: "Listo para postproducción" },
  { value: "EDITING", label: "En edición" },
  { value: "COORDINATOR_REVIEW", label: "Revisión coordinador" },
  { value: "INTERNAL_REVIEW", label: "Revisión interna" },
  { value: "CLIENT_REVIEW", label: "Revisión cliente" },
  { value: "CORRECTIONS", label: "Correcciones" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "OUT_OF_SCOPE", label: "Fuera de alcance" },
];

export default function EditDeliverablePage() {
  const params = useParams();
  const router = useRouter();

  const jobId = params.id as string;
  const pieceId = params.pieceId as string;

  const loadedRef = useRef(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("DEFINED");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [editorUserId, setEditorUserId] = useState("");

  const [deadline, setDeadline] = useState("");
  const [targetFirstCutAt, setTargetFirstCutAt] = useState("");
  const [actualFirstCutAt, setActualFirstCutAt] = useState("");

  const [currentVersion, setCurrentVersion] = useState(1);
  const [urgent, setUrgent] = useState(false);
  const [finalUrl, setFinalUrl] = useState("");

  const [format, setFormat] = useState("");
  const [duration, setDuration] = useState("");
  const [resolution, setResolution] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const [pieceResult, profilesResult] = await Promise.all([
          supabase
            .from("deliverables")
            .select(`
              id,
              name,
              status,
              deadline,
              responsible_user_id,
              editor_user_id,
              target_first_cut_at,
              actual_first_cut_at,
              current_version,
              final_url,
              urgent,
              properties
            `)
            .eq("id", pieceId)
            .eq("job_id", jobId)
            .single(),

          supabase
            .from("profiles")
            .select(`
              id,
              full_name
            `)
            .eq("status", "ACTIVE")
            .order("full_name", { ascending: true }),
        ]);

        if (pieceResult.error || !pieceResult.data) {
          throw new Error("No se pudo cargar la pieza.");
        }

        if (profilesResult.error) {
          throw new Error("No se pudieron cargar los usuarios.");
        }

        const piece = pieceResult.data as PieceData;

        setName(piece.name ?? "");
        setStatus(piece.status ?? "DEFINED");
        setResponsibleUserId(piece.responsible_user_id ?? "");
        setEditorUserId(piece.editor_user_id ?? "");

        setDeadline(toLocalDateInput(piece.deadline));
        setTargetFirstCutAt(toLocalDateTimeInput(piece.target_first_cut_at));
        setActualFirstCutAt(toLocalDateTimeInput(piece.actual_first_cut_at));

        setCurrentVersion(piece.current_version ?? 1);
        setUrgent(Boolean(piece.urgent));
        setFinalUrl(piece.final_url ?? "");

        setFormat(piece.properties?.format ?? "");
        setDuration(piece.properties?.duration ?? "");
        setResolution(piece.properties?.resolution ?? "");

        setProfiles((profilesResult.data ?? []) as Profile[]);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [jobId, pieceId, router]);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving) return;

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Ingresá un nombre.");
      return;
    }

    if (!responsibleUserId) {
      setErrorMessage("Seleccioná un responsable.");
      return;
    }

    if (
      editorUserId &&
      !targetFirstCutAt
    ) {
      setErrorMessage(
        "Si asignás un editor, definí el objetivo de primer corte."
      );
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const properties = {
        format: format.trim() || null,
        duration: duration.trim() || null,
        resolution: resolution.trim() || null,
      };

      const { error } = await supabase
        .from("deliverables")
        .update({
          name: name.trim(),
          status,
          responsible_user_id: responsibleUserId,
          editor_user_id: editorUserId || null,

          deadline: deadline
            ? new Date(`${deadline}T12:00:00`).toISOString()
            : null,

          target_first_cut_at: targetFirstCutAt
            ? new Date(targetFirstCutAt).toISOString()
            : null,

          actual_first_cut_at: actualFirstCutAt
            ? new Date(actualFirstCutAt).toISOString()
            : null,

          current_version: currentVersion || 1,
          urgent,
          final_url: finalUrl.trim() || null,
          properties,
          updated_at: now,
        })
        .eq("id", pieceId)
        .eq("job_id", jobId);

      if (error) {
        throw error;
      }

      router.replace(
        `/trabajos/${jobId}/entregables/${pieceId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error updating deliverable:",
        error
      );

      setErrorMessage(
        "No se pudieron guardar los cambios."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando pieza...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">

        <Link
          href={`/trabajos/${jobId}/entregables/${pieceId}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a la pieza
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <FileVideo2 size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar pieza
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Gestión de postproducción y entrega.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Datos principales
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Estado, responsables, fechas y entrega final.
            </p>
          </div>

          <div className="space-y-7 p-6">

            <Field label="Nombre" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Estado" required>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  {STATUSES.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Urgente">
                <button
                  type="button"
                  onClick={() => setUrgent((value) => !value)}
                  className={`flex h-[46px] w-full items-center justify-between rounded-lg border px-4 text-sm transition ${
                    urgent
                      ? "border-red-900/50 bg-red-950/30 text-red-400"
                      : "border-white/10 bg-[#050607] text-zinc-500"
                  }`}
                >
                  <span>
                    {urgent ? "Marcado como urgente" : "No urgente"}
                  </span>

                  <span
                    className={`h-5 w-9 rounded-full p-0.5 transition ${
                      urgent
                        ? "bg-red-500"
                        : "bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition ${
                        urgent ? "translate-x-4" : ""
                      }`}
                    />
                  </span>
                </button>
              </Field>
            </div>

            <section className="rounded-xl border border-white/10 bg-[#07090B] p-5">
              <div className="mb-5 flex items-start gap-3">
                <UserRound
                  size={18}
                  className="mt-0.5 text-[#45B8E8]"
                />

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Responsables
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    El responsable sigue el entregable; el editor ejecuta la pieza.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Responsable" required>
                  <select
                    value={responsibleUserId}
                    onChange={(e) =>
                      setResponsibleUserId(e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Seleccionar responsable
                    </option>

                    {profiles.map((profile) => (
                      <option
                        key={profile.id}
                        value={profile.id}
                      >
                        {profile.full_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Editor">
                  <select
                    value={editorUserId}
                    onChange={(e) =>
                      setEditorUserId(e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Sin editor asignado
                    </option>

                    {profiles.map((profile) => (
                      <option
                        key={profile.id}
                        value={profile.id}
                      >
                        {profile.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/[0.04] p-5">
              <div className="mb-5 flex items-start gap-3">
                <CalendarDays
                  size={18}
                  className="mt-0.5 text-[#45B8E8]"
                />

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Fechas de postproducción
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    El primer corte objetivo es obligatorio cuando la pieza tiene editor asignado.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Deadline">
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) =>
                      setDeadline(e.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Objetivo primer corte"
                  required={Boolean(editorUserId)}
                >
                  <input
                    type="datetime-local"
                    value={targetFirstCutAt}
                    onChange={(e) =>
                      setTargetFirstCutAt(e.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-6">
                <Field label="Primer corte real">
                  <input
                    type="datetime-local"
                    value={actualFirstCutAt}
                    onChange={(e) =>
                      setActualFirstCutAt(e.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#07090B] p-5">
              <p className="mb-5 text-sm font-medium text-zinc-200">
                Características técnicas
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Formato">
                  <input
                    type="text"
                    value={format}
                    onChange={(e) =>
                      setFormat(e.target.value)
                    }
                    placeholder="Vertical 9:16"
                    className={inputClass}
                  />
                </Field>

                <Field label="Duración">
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) =>
                      setDuration(e.target.value)
                    }
                    placeholder="30–45 s"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-6">
                <Field label="Resolución">
                  <input
                    type="text"
                    value={resolution}
                    onChange={(e) =>
                      setResolution(e.target.value)
                    }
                    placeholder="4K"
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#07090B] p-5">
              <p className="mb-5 text-sm font-medium text-zinc-200">
                Versión y entrega
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Versión actual">
                  <input
                    type="number"
                    min={1}
                    value={currentVersion}
                    onChange={(e) =>
                      setCurrentVersion(
                        Math.max(
                          1,
                          Number(e.target.value)
                        )
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Link final">
                  <input
                    type="url"
                    value={finalUrl}
                    onChange={(e) =>
                      setFinalUrl(e.target.value)
                    }
                    placeholder="https://..."
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">
            <p className="text-xs text-zinc-700">
              * Campos obligatorios
            </p>

            <div className="flex gap-3">
              <Link
                href={`/trabajos/${jobId}/entregables/${pieceId}`}
                className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />

                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && (
          <span className="ml-1 text-[#20A4DD]">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function toLocalDateInput(
  value: string | null
) {
  if (!value) return "";

  const date = new Date(value);

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000
  )
    .toISOString()
    .slice(0, 10);
}

function toLocalDateTimeInput(
  value: string | null
) {
  if (!value) return "";

  const date = new Date(value);

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000
  )
    .toISOString()
    .slice(0, 16);
}