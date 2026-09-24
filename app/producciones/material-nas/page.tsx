import Link from "next/link";
import {
  ArrowLeft,
  HardDrive,
  Link2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/server";

export default async function MaterialNasPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-[1300px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-4 text-sm text-amber-400">
            Iniciá sesión para ver el material detectado en el NAS.
          </div>

        </div>
      </main>
    );
  }

  const {
    data: detections,
    error,
  } = await supabase
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
      file_count,
      total_size_bytes,
      production_id,
      project_id,
      responsible_user_id,
      link_status,
      storage_status,
      final_nas_path,
      stored_at,
      detected_at
    `)
    .order(
      "detected_at",
      {
        ascending: false,
      }
    );

  const rows =
    detections ?? [];

  const unlinked =
    rows.filter(
      (item) =>
        item.link_status ===
        "UNLINKED"
    ).length;

  const linked =
    rows.filter(
      (item) =>
        item.link_status ===
        "LINKED"
    ).length;

  const stored =
    rows.filter(
      (item) =>
        item.storage_status ===
        "STORED"
    ).length;

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1300px] px-5 py-8 md:px-8">

        <Link
          href="/producciones"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Producciones
        </Link>

        <div className="mb-8 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <HardDrive size={21} />
          </div>

          <div>

            <h1 className="text-2xl font-semibold">
              Material detectado en NAS
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Backups detectados automáticamente en el Synology.
            </p>

          </div>

        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            Error al cargar detecciones:{" "}
            {error.message}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">

          <Metric
            label="Sin vincular"
            value={unlinked}
          />

          <Metric
            label="Vinculados"
            value={linked}
          />

          <Metric
            label="Guardados"
            value={stored}
          />

        </div>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 px-6 py-5">

            <h2 className="text-sm font-semibold">
              Detecciones
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Material encontrado dentro de la estructura de Backup del NAS.
            </p>

          </div>

          {rows.length === 0 ? (

            <div className="px-6 py-12 text-center text-sm text-zinc-700">
              Todavía no hay material detectado.
            </div>

          ) : (

            <div className="divide-y divide-white/5">

              {rows.map(
                (item) => (
                  <div
                    key={item.id}
                    className="px-6 py-5"
                  >

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="text-sm font-semibold text-zinc-200">
                            {item.detected_project_name}
                          </h3>

                          <StatusBadge
                            status={item.link_status}
                          />

                        </div>

                        <p className="mt-2 text-sm text-zinc-400">
                          {item.material_name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">

                          <span>
                            Backup:{" "}
                            {formatDate(
                              item.backup_date
                            )}
                          </span>

                          <span>
                            Responsable:{" "}
                            {item.backup_person_name ??
                              "Sin detectar"}
                          </span>

                          {item.file_count !==
                            null && (
                            <span>
                              {item.file_count} archivos
                            </span>
                          )}

                          {item.total_size_bytes !==
                            null && (
                            <span>
                              {formatBytes(
                                item.total_size_bytes
                              )}
                            </span>
                          )}

                        </div>

                        <p className="mt-3 truncate text-[11px] text-zinc-700">
                          {item.nas_path}
                        </p>

                      </div>

                      <div className="flex shrink-0 items-center">

                        {item.link_status ===
                        "UNLINKED" ? (

                          <a
                            href={`/producciones/material-nas/${item.id}/vincular`}
                            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/20"
                          >
                            <Link2 size={14} />
                            Vincular a producción
                          </a>

                        ) : (

                          <a
                            href={
                              item.production_id
                                ? `/producciones/${item.production_id}`
                                : "/producciones"
                            }
                            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 text-xs font-medium text-emerald-400 transition hover:bg-emerald-950/20"
                          >
                            Ver producción
                          </a>

                        )}

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          )}

        </section>

      </div>

    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">

      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold">
        {value}
      </p>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "LINKED") {
    return (
      <span className="rounded-full border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1 text-[10px] text-emerald-400">
        Vinculado
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-900/40 bg-amber-950/20 px-2.5 py-1 text-[10px] text-amber-400">
      Sin vincular
    </span>
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

function formatBytes(
  bytes: number
) {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    );

  return `${(
    bytes /
    Math.pow(
      1024,
      index
    )
  ).toFixed(1)} ${units[index]}`;
}