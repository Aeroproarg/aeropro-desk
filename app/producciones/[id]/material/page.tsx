"use client";

import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  HardDrive,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

type BackupDraft = {
  responsibleId: string;
  finalPath: string;
  comment: string;
};

const downloadStatuses = [
  {
    value: "PENDING",
    label: "Pendiente",
  },
  {
    value: "IN_PROGRESS",
    label: "En descarga",
  },
  {
    value: "DOWNLOADED",
    label: "Descargado",
  },
];

export default function ProductionMaterialPage() {
  const params = useParams();
  const router = useRouter();

  const productionId =
    params.id as string;

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingDownload,
    setSavingDownload,
  ] = useState(false);

  const [
    savingBackupFor,
    setSavingBackupFor,
  ] = useState<string | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    productionName,
    setProductionName,
  ] = useState("");

  const [
    profiles,
    setProfiles,
  ] = useState<Profile[]>([]);

  const [
    downloads,
    setDownloads,
  ] = useState<any[]>([]);

  const [
    backupLinks,
    setBackupLinks,
  ] = useState<any[]>([]);

  /*
   * =====================================
   * NUEVA DESCARGA
   * =====================================
   */

  const [
    materialLabel,
    setMaterialLabel,
  ] = useState("");

  const [
    responsibleUserId,
    setResponsibleUserId,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("PENDING");

  const [
    temporaryPath,
    setTemporaryPath,
  ] = useState("");

  const [
    comment,
    setComment,
  ] = useState("");

  /*
   * =====================================
   * DATOS DE BACKUP POR MATERIAL
   * =====================================
   */

  const [
    backupDrafts,
    setBackupDrafts,
  ] = useState<
    Record<string, BackupDraft>
  >({});

  /*
   * =====================================
   * CARGAR
   * =====================================
   */

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [
      productionResult,
      profilesResult,
      downloadsResult,
      backupLinksResult,
    ] = await Promise.all([
      supabase
        .from("productions")
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          productionId
        )
        .single(),

      supabase
        .from("profiles")
        .select(`
          id,
          full_name
        `)
        .eq(
          "status",
          "ACTIVE"
        )
        .order(
          "full_name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("material_downloads")
        .select(`
          id,
          production_id,
          material_label,
          status,
          responsible_user_id,
          downloaded_at,
          temporary_path,
          comment,
          created_at,
          updated_at,

          responsible:responsible_user_id (
            id,
            full_name
          )
        `)
        .eq(
          "production_id",
          productionId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        ),

      supabase
        .from("backup_downloads")
        .select(`
          backup_id,
          download_id,
          created_at,

          backup:backup_id (
            id,
            production_id,
            status,
            responsible_user_id,
            performed_at,
            final_path,
            comment,
            created_at,
            updated_at,

            responsible:responsible_user_id (
              id,
              full_name
            )
          )
        `),
    ]);

    if (
      productionResult.error ||
      !productionResult.data
    ) {
      setErrorMessage(
        "No se pudo cargar la producción."
      );

      setLoading(false);

      return;
    }

    if (profilesResult.error) {
      console.error(
        profilesResult.error
      );

      setErrorMessage(
        "No se pudieron cargar los responsables."
      );
    }

    if (downloadsResult.error) {
      console.error(
        downloadsResult.error
      );

      setErrorMessage(
        "No se pudo cargar el material."
      );
    }

    if (backupLinksResult.error) {
      console.error(
        backupLinksResult.error
      );

      setErrorMessage(
        "No se pudieron cargar los backups."
      );
    }

    setProductionName(
      productionResult.data.name
    );

    setProfiles(
      (profilesResult.data ??
        []) as Profile[]
    );

    setDownloads(
      downloadsResult.data ??
        []
    );

    /*
     * Solo nos interesan vínculos
     * de descargas de esta producción.
     */

    const productionDownloadIds =
      new Set(
        (
          downloadsResult.data ??
          []
        ).map(
          (item) =>
            item.id
        )
      );

    const filteredLinks =
      (
        backupLinksResult.data ??
        []
      ).filter(
        (link) =>
          productionDownloadIds.has(
            link.download_id
          )
      );

    setBackupLinks(
      filteredLinks
    );

    setLoading(false);
  }

  useEffect(() => {
    if (productionId) {
      loadData();
    }
  }, [productionId]);

  /*
   * =====================================
   * CREAR MATERIAL
   * =====================================
   */

  async function addDownload() {
    if (savingDownload) {
      return;
    }

    setErrorMessage("");

    if (!materialLabel.trim()) {
      setErrorMessage(
        "Escribí qué material se va a descargar."
      );

      return;
    }

    setSavingDownload(true);

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabase
      .from("material_downloads")
      .insert({
        production_id:
          productionId,

        material_label:
          materialLabel.trim(),

        status,

        responsible_user_id:
          responsibleUserId ||
          null,

        downloaded_at:
          status ===
          "DOWNLOADED"
            ? now
            : null,

        temporary_path:
          temporaryPath.trim() ||
          null,

        comment:
          comment.trim() ||
          null,

        updated_at:
          now,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      setSavingDownload(false);

      return;
    }

    setMaterialLabel("");
    setResponsibleUserId("");
    setStatus("PENDING");
    setTemporaryPath("");
    setComment("");

    await loadData();

    setSavingDownload(false);

    router.refresh();
  }

  /*
   * =====================================
   * CAMBIAR ESTADO DE DESCARGA
   * =====================================
   */

  async function updateDownloadStatus(
    download: any,
    newStatus: string
  ) {
    const existingBackup =
      findBackupForDownload(
        download.id
      );

    /*
     * Si ya está guardado definitivamente,
     * no modificamos el recorrido anterior.
     */

    if (existingBackup) {
      return;
    }

    setErrorMessage("");

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabase
      .from("material_downloads")
      .update({
        status:
          newStatus,

        downloaded_at:
          newStatus ===
          "DOWNLOADED"
            ? download.downloaded_at ??
              now
            : null,

        updated_at:
          now,
      })
      .eq(
        "id",
        download.id
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setDownloads(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            download.id
              ? {
                  ...item,

                  status:
                    newStatus,

                  downloaded_at:
                    newStatus ===
                    "DOWNLOADED"
                      ? item.downloaded_at ??
                        now
                      : null,
                }
              : item
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * CONFIRMAR GUARDADO DEFINITIVO
   * =====================================
   */

  async function confirmBackup(
    download: any
  ) {
    if (
      savingBackupFor ===
      download.id
    ) {
      return;
    }

    setErrorMessage("");

    if (
      download.status !==
      "DOWNLOADED"
    ) {
      setErrorMessage(
        "Primero tenés que marcar el material como Descargado."
      );

      return;
    }

    const draft =
      backupDrafts[
        download.id
      ] ?? {
        responsibleId: "",
        finalPath: "",
        comment: "",
      };

    if (!draft.finalPath.trim()) {
      setErrorMessage(
        "Indicá dónde quedó guardado el material definitivamente."
      );

      return;
    }

    setSavingBackupFor(
      download.id
    );

    const now =
      new Date().toISOString();

    /*
     * 1. Crear backup definitivo
     */

    const {
      data: backup,
      error:
        backupError,
    } = await supabase
      .from("material_backups")
      .insert({
        production_id:
          productionId,

        status:
          "COMPLETED",

        responsible_user_id:
          draft.responsibleId ||
          null,

        performed_at:
          now,

        final_path:
          draft.finalPath.trim(),

        comment:
          draft.comment.trim() ||
          null,

        updated_at:
          now,
      })
      .select(`
        id
      `)
      .single();

    if (
      backupError ||
      !backup
    ) {
      console.error(
        backupError
      );

      setErrorMessage(
        backupError?.message ??
          "No se pudo registrar el backup."
      );

      setSavingBackupFor(
        null
      );

      return;
    }

    /*
     * 2. Vincular ese backup
     * con ESTA descarga concreta
     */

    const {
      error:
        linkError,
    } = await supabase
      .from("backup_downloads")
      .insert({
        backup_id:
          backup.id,

        download_id:
          download.id,
      });

    if (linkError) {
      console.error(
        linkError
      );

      /*
       * Limpieza si falla el vínculo.
       */

      await supabase
        .from("material_backups")
        .delete()
        .eq(
          "id",
          backup.id
        );

      setErrorMessage(
        linkError.message
      );

      setSavingBackupFor(
        null
      );

      return;
    }

    setBackupDrafts(
      (current) => {
        const copy = {
          ...current,
        };

        delete copy[
          download.id
        ];

        return copy;
      }
    );

    await loadData();

    setSavingBackupFor(
      null
    );

    router.refresh();
  }

  /*
   * =====================================
   * BORRAR MATERIAL
   * =====================================
   */

  async function removeDownload(
    download: any
  ) {
    const backup =
      findBackupForDownload(
        download.id
      );

    if (backup) {
      setErrorMessage(
        "Este material ya está guardado definitivamente y no se puede eliminar desde acá."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "¿Eliminar este material de la producción?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("material_downloads")
      .delete()
      .eq(
        "id",
        download.id
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setDownloads(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            download.id
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * HELPERS LOCALES
   * =====================================
   */

  function findBackupForDownload(
    downloadId: string
  ) {
    const link =
      backupLinks.find(
        (item) =>
          item.download_id ===
          downloadId
      );

    if (!link) {
      return null;
    }

    return firstRelation(
      link.backup
    );
  }

  function updateBackupDraft(
    downloadId: string,
    field:
      | "responsibleId"
      | "finalPath"
      | "comment",
    value: string
  ) {
    setBackupDrafts(
      (current) => ({
        ...current,

        [downloadId]: {
          responsibleId:
            current[
              downloadId
            ]?.responsibleId ??
            "",

          finalPath:
            current[
              downloadId
            ]?.finalPath ??
            "",

          comment:
            current[
              downloadId
            ]?.comment ??
            "",

          [field]:
            value,
        },
      })
    );
  }

  /*
   * =====================================
   * MÉTRICAS
   * =====================================
   */

  const downloadedCount =
    downloads.filter(
      (item) =>
        item.status ===
        "DOWNLOADED"
    ).length;

  const storedCount =
    downloads.filter(
      (item) =>
        Boolean(
          findBackupForDownload(
            item.id
          )
        )
    ).length;

  const pendingBackupCount =
    downloads.filter(
      (item) =>
        item.status ===
          "DOWNLOADED" &&
        !findBackupForDownload(
          item.id
        )
    ).length;

  /*
   * =====================================
   * LOADING
   * =====================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">

        <div className="mx-auto max-w-[1250px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-6 py-10 text-center text-sm text-zinc-600">
            Cargando material...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1250px] px-5 py-8 md:px-8">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="mb-8">

          <Link
            href={`/producciones/${productionId}`}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />

            Volver a la producción
          </Link>

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <HardDrive
                size={21}
              />
            </div>

            <div>

              <h1 className="text-2xl font-semibold tracking-tight">
                Material
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {productionName}
              </p>

            </div>

          </div>

        </div>

        {/* =====================================
            MÉTRICAS
        ===================================== */}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">

          <MetricCard
            label="Material registrado"
            value={
              downloads.length
            }
          />

          <MetricCard
            label="Pendiente de guardar"
            value={
              pendingBackupCount
            }
            alert={
              pendingBackupCount >
              0
            }
          />

          <MetricCard
            label="Guardado"
            value={
              storedCount
            }
            success={
              storedCount > 0
            }
          />

        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* =====================================
            NUEVO MATERIAL
        ===================================== */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Registrar material"
            subtitle="Cada tarjeta, cámara, drone, audio o grupo de material sigue su propio recorrido."
            icon={
              <Download
                size={17}
              />
            }
          />

          <div className="p-5">

            <div className="grid gap-4 md:grid-cols-2">

              <Field
                label="Material"
                required
              >
                <input
                  type="text"
                  value={
                    materialLabel
                  }
                  onChange={(e) =>
                    setMaterialLabel(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Sony FX3 · Tarjeta A"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Responsable de descarga"
              >
                <select
                  value={
                    responsibleUserId
                  }
                  onChange={(e) =>
                    setResponsibleUserId(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Sin definir
                  </option>

                  {profiles.map(
                    (profile) => (
                      <option
                        key={
                          profile.id
                        }
                        value={
                          profile.id
                        }
                      >
                        {
                          profile.full_name
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field
                label="Estado"
              >
                <select
                  value={
                    status
                  }
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  {downloadStatuses.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field
                label="Ubicación temporal"
              >
                <input
                  type="text"
                  value={
                    temporaryPath
                  }
                  onChange={(e) =>
                    setTemporaryPath(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Backup / Botania / FX3"
                  className={inputClass}
                />
              </Field>

            </div>

            <div className="mt-4">

              <Field
                label="Comentario"
              >
                <textarea
                  value={
                    comment
                  }
                  onChange={(e) =>
                    setComment(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Ej: Tarjeta 128 GB · cámara A"
                  className={`${inputClass} h-auto resize-none py-3`}
                />
              </Field>

            </div>

            <div className="mt-4 flex justify-end">

              <button
                type="button"
                onClick={
                  addDownload
                }
                disabled={
                  savingDownload
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                <Plus
                  size={15}
                />

                {savingDownload
                  ? "Agregando..."
                  : "Agregar material"}
              </button>

            </div>

          </div>

        </section>

        {/* =====================================
            RECORRIDO DEL MATERIAL
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Recorrido del material"
            subtitle="Pendiente → En descarga → Descargado → Guardado."
            icon={
              <HardDrive
                size={17}
              />
            }
            count={
              downloads.length
            }
          />

          {downloads.length ===
          0 ? (

            <EmptyState
              text="Todavía no hay material registrado."
            />

          ) : (

            <div className="divide-y divide-white/10">

              {downloads.map(
                (download) => {

                  const responsible =
                    firstRelation(
                      download.responsible
                    );

                  const backup =
                    findBackupForDownload(
                      download.id
                    );

                  const backupResponsible =
                    backup
                      ? firstRelation(
                          backup.responsible
                        )
                      : null;

                  const isStored =
                    Boolean(
                      backup
                    );

                  const draft =
                    backupDrafts[
                      download.id
                    ] ?? {
                      responsibleId:
                        "",
                      finalPath:
                        "",
                      comment:
                        "",
                    };

                  return (
                    <div
                      key={
                        download.id
                      }
                      className="p-5"
                    >

                      {/* CABECERA MATERIAL */}

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-sm font-semibold text-zinc-200">
                              {
                                download.material_label
                              }
                            </h3>

                            <MaterialStatusBadge
                              status={
                                isStored
                                  ? "STORED"
                                  : download.status
                              }
                            />

                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-zinc-600">

                            <span>
                              Descarga:{" "}
                              {responsible?.full_name ??
                                "Sin responsable"}
                            </span>

                            {download.downloaded_at && (
                              <span>
                                Descargado:{" "}
                                {formatDateTime(
                                  download.downloaded_at
                                )}
                              </span>
                            )}

                          </div>

                          {download.temporary_path && (
                            <p className="mt-2 text-xs text-zinc-600">
                              Temporal:{" "}
                              {
                                download.temporary_path
                              }
                            </p>
                          )}

                          {download.comment && (
                            <p className="mt-1 text-xs text-zinc-700">
                              {
                                download.comment
                              }
                            </p>
                          )}

                        </div>

                        <div className="flex items-center gap-3">

                          {!isStored && (
                            <select
                              value={
                                download.status
                              }
                              onChange={(e) =>
                                updateDownloadStatus(
                                  download,
                                  e.target.value
                                )
                              }
                              className={smallSelectClass}
                            >
                              {downloadStatuses.map(
                                (
                                  item
                                ) => (
                                  <option
                                    key={
                                      item.value
                                    }
                                    value={
                                      item.value
                                    }
                                  >
                                    {
                                      item.label
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          )}

                          {!isStored && (
                            <button
                              type="button"
                              onClick={() =>
                                removeDownload(
                                  download
                                )
                              }
                              title="Eliminar material"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-red-900/40 hover:bg-red-950/20 hover:text-red-400"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          )}

                        </div>

                      </div>

                      {/* RECORRIDO VISUAL */}

                      <MaterialProgress
                        status={
                          download.status
                        }
                        stored={
                          isStored
                        }
                      />

                      {/* =====================================
                          DESCARGADO, FALTA GUARDAR
                      ===================================== */}

                      {download.status ===
                        "DOWNLOADED" &&
                        !isStored && (

                        <div className="mt-5 rounded-xl border border-amber-900/30 bg-amber-950/[0.08] p-4">

                          <div className="mb-4">

                            <p className="text-sm font-medium text-amber-400">
                              Pendiente de guardado definitivo
                            </p>

                            <p className="mt-1 text-xs text-zinc-600">
                              La descarga terminó. Confirmá ahora dónde quedó respaldado este mismo material.
                            </p>

                          </div>

                          <div className="grid gap-4 md:grid-cols-2">

                            <Field
                              label="Responsable del backup"
                            >
                              <select
                                value={
                                  draft.responsibleId
                                }
                                onChange={(e) =>
                                  updateBackupDraft(
                                    download.id,
                                    "responsibleId",
                                    e.target.value
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">
                                  Sin definir
                                </option>

                                {profiles.map(
                                  (
                                    profile
                                  ) => (
                                    <option
                                      key={
                                        profile.id
                                      }
                                      value={
                                        profile.id
                                      }
                                    >
                                      {
                                        profile.full_name
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </Field>

                            <Field
                              label="Ubicación definitiva"
                              required
                            >
                              <input
                                type="text"
                                value={
                                  draft.finalPath
                                }
                                onChange={(e) =>
                                  updateBackupDraft(
                                    download.id,
                                    "finalPath",
                                    e.target.value
                                  )
                                }
                                placeholder="NAS / Proyectos activos / Cliente / Fecha / Crudos"
                                className={inputClass}
                              />
                            </Field>

                            <div className="md:col-span-2">

                              <Field
                                label="Comentario del backup"
                              >
                                <textarea
                                  value={
                                    draft.comment
                                  }
                                  onChange={(e) =>
                                    updateBackupDraft(
                                      download.id,
                                      "comment",
                                      e.target.value
                                    )
                                  }
                                  rows={2}
                                  placeholder="Opcional"
                                  className={`${inputClass} h-auto resize-none py-3`}
                                />
                              </Field>

                            </div>

                          </div>

                          <div className="mt-4 flex justify-end">

                            <button
                              type="button"
                              onClick={() =>
                                confirmBackup(
                                  download
                                )
                              }
                              disabled={
                                savingBackupFor ===
                                download.id
                              }
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                            >
                              <HardDrive
                                size={15}
                              />

                              {savingBackupFor ===
                              download.id
                                ? "Guardando..."
                                : "Confirmar guardado"}
                            </button>

                          </div>

                        </div>
                      )}

                      {/* =====================================
                          GUARDADO
                      ===================================== */}

                      {isStored && (
                        <div className="mt-5 rounded-xl border border-emerald-900/30 bg-emerald-950/[0.08] p-4">

                          <div className="flex items-start gap-3">

                            <CheckCircle2
                              size={18}
                              className="mt-0.5 shrink-0 text-emerald-400"
                            />

                            <div>

                              <p className="text-sm font-medium text-emerald-400">
                                Material guardado
                              </p>

                              <p className="mt-2 text-xs text-zinc-400">
                                {
                                  backup.final_path ??
                                  "Sin ruta registrada"
                                }
                              </p>

                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-zinc-600">

                                <span>
                                  Responsable:{" "}
                                  {backupResponsible?.full_name ??
                                    "Sin definir"}
                                </span>

                                {backup.performed_at && (
                                  <span>
                                    Guardado:{" "}
                                    {formatDateTime(
                                      backup.performed_at
                                    )}
                                  </span>
                                )}

                              </div>

                              {backup.comment && (
                                <p className="mt-2 text-xs text-zinc-600">
                                  {
                                    backup.comment
                                  }
                                </p>
                              )}

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        <div className="mt-6 flex justify-end">

          <Link
            href={`/producciones/${productionId}`}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-[#0B0F12] px-5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            Volver a la producción
          </Link>

        </div>

      </div>

    </main>
  );
}

/*
 * =====================================
 * RECORRIDO VISUAL
 * =====================================
 */

function MaterialProgress({
  status,
  stored,
}: {
  status: string;
  stored: boolean;
}) {
  const currentStep =
    stored
      ? 4
      : status ===
        "DOWNLOADED"
      ? 3
      : status ===
        "IN_PROGRESS"
      ? 2
      : 1;

  const steps = [
    "Pendiente",
    "En descarga",
    "Descargado",
    "Guardado",
  ];

  return (
    <div className="mt-5">

      <div className="grid grid-cols-4 gap-2">

        {steps.map(
          (
            label,
            index
          ) => {
            const step =
              index + 1;

            const active =
              step <=
              currentStep;

            return (
              <div
                key={
                  label
                }
              >

                <div
                  className={`h-1.5 rounded-full ${
                    active
                      ? stored &&
                        step ===
                          4
                        ? "bg-emerald-500"
                        : "bg-[#20A4DD]"
                      : "bg-white/[0.06]"
                  }`}
                />

                <p
                  className={`mt-2 text-[10px] ${
                    active
                      ? "text-zinc-400"
                      : "text-zinc-700"
                  }`}
                >
                  {label}
                </p>

              </div>
            );
          }
        )}

      </div>

    </div>
  );
}

/*
 * =====================================
 * BADGE
 * =====================================
 */

function MaterialStatusBadge({
  status,
}: {
  status: string;
}) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    PENDING: {
      label:
        "Pendiente",

      className:
        "border-zinc-700 bg-zinc-900 text-zinc-500",
    },

    IN_PROGRESS: {
      label:
        "En descarga",

      className:
        "border-amber-900/40 bg-amber-950/20 text-amber-400",
    },

    DOWNLOADED: {
      label:
        "Descargado",

      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    STORED: {
      label:
        "Guardado",

      className:
        "border-emerald-900/40 bg-emerald-950/20 text-emerald-400",
    },
  };

  const current =
    config[
      status
    ] ?? {
      label:
        status,

      className:
        "border-white/10 text-zinc-500",
    };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] ${current.className}`}
    >
      {current.label}
    </span>
  );
}

/*
 * =====================================
 * COMPONENTES
 * =====================================
 */

function SectionHeader({
  title,
  subtitle,
  icon,
  count,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

      <div className="flex items-center gap-3">

        <div className="text-[#45B8E8]">
          {icon}
        </div>

        <div>

          <h2 className="text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-xs text-zinc-600">
            {subtitle}
          </p>

        </div>

      </div>

      {typeof count ===
        "number" && (
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
          {count}
        </span>
      )}

    </div>
  );
}

function MetricCard({
  label,
  value,
  alert = false,
  success = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        alert
          ? "border-amber-900/30 bg-amber-950/[0.07]"
          : success
          ? "border-emerald-900/30 bg-emerald-950/[0.07]"
          : "border-white/10 bg-[#0B0F12]"
      }`}
    >

      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-3 text-2xl font-semibold ${
          alert
            ? "text-amber-400"
            : success
            ? "text-emerald-400"
            : "text-zinc-100"
        }`}
      >
        {value}
      </p>

    </div>
  );
}

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

      <label className="mb-2 block text-xs font-medium text-zinc-500">

        {label}

        {required && (
          <span className="ml-1 text-[#45B8E8]">
            *
          </span>
        )}

      </label>

      {children}

    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-12 text-center text-sm text-zinc-700">
      {text}
    </div>
  );
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

function firstRelation(
  relation: any
) {
  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return (
    relation ??
    null
  );
}

function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "es-AR",
    {
      timeZone: displayTimeZone(value),
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD] focus:ring-1 focus:ring-[#20A4DD]/20";

const smallSelectClass =
  "h-9 rounded-lg border border-white/10 bg-[#050607] px-3 text-xs text-zinc-400 outline-none transition focus:border-[#20A4DD] [color-scheme:dark]";