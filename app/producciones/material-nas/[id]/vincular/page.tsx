"use client";

import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  HardDrive,
  Link2,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Detection = {
  id: string;
  nas_path: string;
  backup_date: string | null;
  backup_person_name: string | null;
  detected_project_name: string | null;
  material_name: string | null;
  production_id: string | null;
  link_status: string;
};

type Production = {
  id: string;
  name: string;
  start_at: string | null;
  location: string | null;
  status: string;
};

export default function LinkNasMaterialPage() {
  const params = useParams();
  const router = useRouter();

  const detectionId =
    params.id as string;

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    detection,
    setDetection,
  ] = useState<Detection | null>(
    null
  );

  const [
    productions,
    setProductions,
  ] = useState<Production[]>([]);

  const [
    selectedProductionId,
    setSelectedProductionId,
  ] = useState("");

  useEffect(() => {
    if (detectionId) {
      loadData();
    }
  }, [detectionId]);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [
      detectionResult,
      productionsResult,
    ] = await Promise.all([
      supabase
        .from(
          "nas_material_detections"
        )
        .select(`
          id,
          nas_path,
          backup_date,
          backup_person_name,
          detected_project_name,
          material_name,
          production_id,
          link_status
        `)
        .eq(
          "id",
          detectionId
        )
        .single(),

      supabase
        .from("productions")
        .select(`
          id,
          name,
          start_at,
          location,
          status
        `)
        .order(
          "start_at",
          {
            ascending: false,
            nullsFirst: false,
          }
        ),
    ]);

    if (
      detectionResult.error ||
      !detectionResult.data
    ) {
      console.error(
        detectionResult.error
      );

      setErrorMessage(
        "No se pudo cargar el material detectado."
      );

      setLoading(false);

      return;
    }

    if (
      productionsResult.error
    ) {
      console.error(
        productionsResult.error
      );

      setErrorMessage(
        "No se pudieron cargar las producciones."
      );
    }

    setDetection(
      detectionResult.data
    );

    setProductions(
      productionsResult.data ??
        []
    );

    setSelectedProductionId(
      detectionResult.data
        .production_id ??
        ""
    );

    setLoading(false);
  }

  async function linkProduction() {
    if (saving) {
      return;
    }

    setErrorMessage("");

    if (
      !selectedProductionId
    ) {
      setErrorMessage(
        "Elegí una producción."
      );

      return;
    }

    setSaving(true);

    const {
      error,
    } = await supabase
      .from(
        "nas_material_detections"
      )
      .update({
        production_id:
          selectedProductionId,

        link_status:
          "LINKED",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        detectionId
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    router.push(
      "/producciones/material-nas"
    );

    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-[900px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-6 py-12 text-center text-sm text-zinc-600">
            Cargando...
          </div>

        </div>
      </main>
    );
  }

  if (!detection) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-[900px] px-5 py-8 md:px-8">

          <p className="text-sm text-zinc-500">
            No se encontró el material.
          </p>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[900px] px-5 py-8 md:px-8">

        <Link
          href="/producciones/material-nas"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft
            size={16}
          />

          Volver a material NAS
        </Link>

        <div className="mb-8 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <Link2
              size={20}
            />
          </div>

          <div>

            <h1 className="text-2xl font-semibold">
              Vincular a producción
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Asociá el material detectado en el NAS con una producción de AeroPro Desk.
            </p>

          </div>

        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* MATERIAL DETECTADO */}

        <section className="mb-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-2 text-[#45B8E8]">

              <HardDrive
                size={16}
              />

              <h2 className="text-sm font-semibold text-white">
                Material detectado
              </h2>

            </div>

          </div>

          <div className="p-6">

            <p className="text-lg font-semibold">
              {detection.detected_project_name ??
                "Proyecto sin identificar"}
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              {detection.material_name ??
                "Material sin nombre"}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600">

              <span>
                Backup:{" "}
                {formatDate(
                  detection.backup_date
                )}
              </span>

              <span>
                Responsable:{" "}
                {detection.backup_person_name ??
                  "Sin detectar"}
              </span>

            </div>

            <p className="mt-4 break-all text-[11px] text-zinc-700">
              {detection.nas_path}
            </p>

          </div>

        </section>

        {/* VINCULACIÓN */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 px-6 py-5">

            <h2 className="text-sm font-semibold">
              Producción
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Elegí la producción a la que pertenece este material.
            </p>

          </div>

          <div className="p-6">

            <label className="mb-2 block text-xs font-medium text-zinc-500">
              Vincular a
            </label>

            <select
              value={
                selectedProductionId
              }
              onChange={(event) =>
                setSelectedProductionId(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#20A4DD] focus:ring-1 focus:ring-[#20A4DD]/20 [color-scheme:dark]"
            >

              <option value="">
                Seleccionar producción...
              </option>

              {productions.map(
                (production) => (
                  <option
                    key={
                      production.id
                    }
                    value={
                      production.id
                    }
                  >
                    {formatProductionLabel(
                      production
                    )}
                  </option>
                )
              )}

            </select>

            {productions.length ===
              0 && (
              <p className="mt-3 text-xs text-amber-400">
                No hay producciones disponibles.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">

              <Link
                href="/producciones/material-nas"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </Link>

              <button
                type="button"
                onClick={
                  linkProduction
                }
                disabled={
                  saving ||
                  !selectedProductionId
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check
                  size={15}
                />

                {saving
                  ? "Vinculando..."
                  : "Confirmar vinculación"}
              </button>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Sin fecha";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  return `${day}/${month}/${year}`;
}

function formatProductionLabel(
  production: Production
) {
  const date =
    production.start_at
      ? new Date(
          production.start_at
        ).toLocaleDateString(
          "es-AR",
          {
            timeZone: displayTimeZone(production.start_at),
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }
        )
      : "Sin fecha";

  const location =
    production.location
      ? ` · ${production.location}`
      : "";

  return `${production.name} — ${date}${location}`;
}