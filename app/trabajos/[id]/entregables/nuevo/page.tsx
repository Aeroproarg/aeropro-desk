"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  FileVideo2,
  Layers3,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type DeliverableType = {
  id: string;
  name: string;
};

type JobData = {
  id: string;
  name: string;
  responsible_user_id: string;
};

export default function NewDeliverableGroupPage() {
  const params = useParams();
  const router = useRouter();

  const jobId = params.id as string;

  const loadedRef = useRef(false);

  const [job, setJob] = useState<JobData | null>(null);

  const [types, setTypes] = useState<DeliverableType[]>([]);

  const [groupName, setGroupName] = useState("");

  const [deliverableTypeId, setDeliverableTypeId] =
    useState("");

  const [quantity, setQuantity] = useState(1);

  const [format, setFormat] = useState("");
  const [duration, setDuration] = useState("");
  const [resolution, setResolution] = useState("");

  const [deadline, setDeadline] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

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

        const [
          jobResult,
          typesResult,
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select(`
              id,
              name,
              responsible_user_id
            `)
            .eq("id", jobId)
            .single(),

          supabase
            .from("deliverable_types")
            .select(`
              id,
              name
            `)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (
          jobResult.error ||
          !jobResult.data
        ) {
          console.error(
            "Error loading job:",
            jobResult.error
          );

          throw new Error(
            "No se pudo cargar el Trabajo."
          );
        }

        if (typesResult.error) {
          console.error(
            "Error loading deliverable types:",
            typesResult.error
          );

          throw new Error(
            "No se pudieron cargar los tipos de Entregable."
          );
        }

        setJob(
          jobResult.data as JobData
        );

        setTypes(
          (typesResult.data ??
            []) as DeliverableType[]
        );
      } catch (error) {
        console.error(
          "Error loading deliverable form:",
          error
        );

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
  }, [jobId, router]);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving || !job) return;

    setErrorMessage("");

    /*
     * VALIDACIONES
     */

    if (!groupName.trim()) {
      setErrorMessage(
        "Ingresá un nombre para el Grupo."
      );

      return;
    }

    if (!deliverableTypeId) {
      setErrorMessage(
        "Seleccioná un tipo de Entregable."
      );

      return;
    }

    if (
      !quantity ||
      quantity < 1 ||
      quantity > 100
    ) {
      setErrorMessage(
        "La cantidad debe estar entre 1 y 100."
      );

      return;
    }

    setSaving(true);

    try {
      /*
       * Transformamos el deadline
       * solamente una vez.
       */

      const deadlineIso = deadline
        ? new Date(
            `${deadline}T12:00:00`
          ).toISOString()
        : null;

      /*
       * Características comunes
       * que van a heredar las piezas.
       */

      const commonProperties = {
        format:
          format.trim() || null,

        duration:
          duration.trim() || null,

        resolution:
          resolution.trim() || null,
      };

      /*
       * ===================================
       * 1. CREAR GRUPO DE ENTREGABLES
       * ===================================
       */

      const {
        data: createdGroup,
        error: groupError,
      } = await supabase
        .from("deliverable_groups")
        .insert({
          job_id: jobId,

          name:
            groupName.trim(),

          type_id:
            deliverableTypeId,

          quantity,

          common_properties:
            commonProperties,

          group_deadline:
            deadlineIso,

          notes:
            notes.trim() || null,
        })
        .select("id")
        .single();

      if (
        groupError ||
        !createdGroup
      ) {
        console.error(
          "Error creating deliverable group:",
          groupError
        );

        throw (
          groupError ??
          new Error(
            "No se pudo crear el Grupo de Entregables."
          )
        );
      }

      /*
       * ===================================
       * 2. GENERAR PIEZAS INDIVIDUALES
       * ===================================
       */

      const basePieceName =
        singularizeGroupName(
          groupName.trim()
        );

      const pieces = Array.from(
        {
          length: quantity,
        },

        (_, index) => {
          const pieceName =
            quantity === 1
              ? groupName.trim()
              : `${basePieceName} ${
                  index + 1
                }`;

          return {
            group_id:
              createdGroup.id,

            job_id:
              jobId,

            name:
              pieceName,

            type_id:
              deliverableTypeId,

            properties:
              commonProperties,

            status:
              "DEFINED",

            deadline:
              deadlineIso,

            responsible_user_id:
              job.responsible_user_id,

            editor_user_id:
              null,

            target_first_cut_at:
              null,

            actual_first_cut_at:
              null,

            final_url:
              null,

            urgent:
              false,

            queue_position:
              null,
          };
        }
      );

      const {
        error: piecesError,
      } = await supabase
        .from("deliverables")
        .insert(pieces);

      /*
       * ===================================
       * 3. SI FALLAN LAS PIEZAS
       *    BORRAMOS EL GRUPO INCOMPLETO
       * ===================================
       */

      if (piecesError) {
        console.error(
          "Error creating deliverable pieces:",
          piecesError
        );

        const {
          error: cleanupError,
        } = await supabase
          .from(
            "deliverable_groups"
          )
          .delete()
          .eq(
            "id",
            createdGroup.id
          );

        if (cleanupError) {
          console.error(
            "Error cleaning incomplete group:",
            cleanupError
          );
        }

        throw piecesError;
      }

      /*
       * ===================================
       * 4. VOLVER AL TRABAJO
       * ===================================
       */

      router.replace(
        `/trabajos/${jobId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error creating deliverables:",
        error
      );

      setErrorMessage(
        "No se pudieron crear los Entregables."
      );

      setSaving(false);
    }
  }

  /*
   * ===================================
   * LOADING
   * ===================================
   */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando...
        </p>
      </main>
    );
  }

  /*
   * ===================================
   * ERROR AL CARGAR TRABAJO
   * ===================================
   */

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <div className="max-w-md text-center">
          <p className="text-sm text-red-400">
            {errorMessage ||
              "No se pudo cargar el Trabajo."}
          </p>

          <Link
            href={`/trabajos/${jobId}`}
            className="mt-5 inline-flex text-sm text-[#45B8E8] transition hover:text-white"
          >
            Volver al Trabajo
          </Link>
        </div>
      </main>
    );
  }

  /*
   * ===================================
   * INTERFAZ
   * ===================================
   */

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">

        {/* VOLVER */}

        <Link
          href={`/trabajos/${jobId}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />

          Volver al Trabajo
        </Link>

        {/* CABECERA */}

        <div className="mb-8 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <Layers3 size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Nuevo Grupo de Entregables
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              {job.name}
            </p>
          </div>

        </div>

        {/* FORMULARIO */}

        <form
          onSubmit={
            handleSubmit
          }
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >

          {/* HEADER */}

          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Definición del entregable
            </h2>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Definí el compromiso general.
              AeroPro Desk generará automáticamente
              las piezas individuales.
            </p>
          </div>

          {/* CAMPOS */}

          <div className="space-y-7 p-6">

            {/* NOMBRE */}

            <Field
              label="Nombre del grupo"
              required
            >
              <input
                type="text"
                value={
                  groupName
                }
                onChange={(
                  e
                ) =>
                  setGroupName(
                    e.target.value
                  )
                }
                placeholder="Ej. 5 Reels"
                className={
                  inputClass
                }
              />

              <p className="mt-2 text-xs text-zinc-600">
                Ejemplos: 5 Reels, Video institucional,
                Fotografías editadas.
              </p>
            </Field>

            {/* TIPO + CANTIDAD */}

            <div className="grid gap-6 md:grid-cols-2">

              <Field
                label="Tipo"
                required
              >
                <select
                  value={
                    deliverableTypeId
                  }
                  onChange={(
                    e
                  ) =>
                    setDeliverableTypeId(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                >
                  <option value="">
                    Seleccionar tipo
                  </option>

                  {types.map(
                    (type) => (
                      <option
                        key={
                          type.id
                        }
                        value={
                          type.id
                        }
                      >
                        {type.name}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field
                label="Cantidad"
                required
              >
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={
                    quantity
                  }
                  onChange={(
                    e
                  ) => {
                    const value =
                      Number(
                        e.target.value
                      );

                    if (
                      Number.isNaN(
                        value
                      )
                    ) {
                      setQuantity(
                        1
                      );

                      return;
                    }

                    setQuantity(
                      Math.min(
                        100,
                        Math.max(
                          1,
                          value
                        )
                      )
                    );
                  }}
                  className={
                    inputClass
                  }
                />
              </Field>

            </div>

            {/* CARACTERÍSTICAS */}

            <section className="rounded-xl border border-white/10 bg-[#07090B] p-5">

              <div className="mb-5 flex items-start gap-3">

                <FileVideo2
                  size={18}
                  className="mt-0.5 shrink-0 text-[#45B8E8]"
                />

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Características
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Estos datos se aplicarán inicialmente
                    a todas las piezas del grupo.
                  </p>
                </div>

              </div>

              <div className="grid gap-6 md:grid-cols-2">

                {/* FORMATO */}

                <Field label="Formato / relación">
                  <select
                    value={
                      format
                    }
                    onChange={(
                      e
                    ) =>
                      setFormat(
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Sin especificar
                    </option>

                    <option value="Horizontal 16:9">
                      Horizontal 16:9
                    </option>

                    <option value="Vertical 9:16">
                      Vertical 9:16
                    </option>

                    <option value="Cuadrado 1:1">
                      Cuadrado 1:1
                    </option>

                    <option value="Otro">
                      Otro
                    </option>
                  </select>
                </Field>

                {/* DURACIÓN */}

                <Field label="Duración">
                  <input
                    type="text"
                    value={
                      duration
                    }
                    onChange={(
                      e
                    ) =>
                      setDuration(
                        e.target.value
                      )
                    }
                    placeholder="Ej. 30–45 s"
                    className={
                      inputClass
                    }
                  />
                </Field>

              </div>

              {/* RESOLUCIÓN */}

              <div className="mt-6">
                <Field label="Resolución">
                  <input
                    type="text"
                    value={
                      resolution
                    }
                    onChange={(
                      e
                    ) =>
                      setResolution(
                        e.target.value
                      )
                    }
                    placeholder="Ej. 4K, 1080p"
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>

            </section>

            {/* DEADLINE */}

            <Field label="Deadline del grupo">

              <div className="relative">

                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  type="date"
                  value={
                    deadline
                  }
                  onChange={(
                    e
                  ) =>
                    setDeadline(
                      e.target.value
                    )
                  }
                  className={`${inputClass} pl-11`}
                />

              </div>

              <p className="mt-2 text-xs leading-5 text-zinc-600">
                Este deadline se aplicará inicialmente
                también a todas las piezas individuales.
              </p>

            </Field>

            {/* OBSERVACIONES */}

            <Field label="Observaciones">

              <textarea
                rows={4}
                value={
                  notes
                }
                onChange={(
                  e
                ) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="Indicaciones generales del entregable..."
                className={`${inputClass} resize-none leading-6`}
              />

            </Field>

            {/* PREVIEW */}

            <section className="rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/[0.04] p-5">

              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#45B8E8]">
                Vista previa
              </p>

              <p className="mt-3 text-sm font-medium text-zinc-200">
                {groupName.trim() ||
                  "Nuevo grupo"}
              </p>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Se crearán{" "}
                <strong className="font-medium text-zinc-300">
                  {quantity}{" "}
                  {quantity ===
                  1
                    ? "pieza"
                    : "piezas"}
                </strong>
                .
              </p>

              {quantity >
                1 && (
                <div className="mt-4 flex flex-wrap gap-2">

                  {Array.from({
                    length:
                      Math.min(
                        quantity,
                        8
                      ),
                  }).map(
                    (
                      _,
                      index
                    ) => (
                      <span
                        key={
                          index
                        }
                        className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-zinc-500"
                      >
                        {singularizeGroupName(
                          groupName.trim() ||
                            "Pieza"
                        )}{" "}
                        {index +
                          1}
                      </span>
                    )
                  )}

                  {quantity >
                    8 && (
                    <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-600">
                      +
                      {quantity -
                        8}
                    </span>
                  )}

                </div>
              )}

            </section>

            {/* ERROR */}

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

          </div>

          {/* FOOTER */}

          <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">

            <p className="text-xs text-zinc-700">
              * Campos obligatorios
            </p>

            <div className="flex gap-3">

              <Link
                href={`/trabajos/${jobId}`}
                className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <Save
                  size={16}
                />

                {saving
                  ? "Creando..."
                  : quantity ===
                      1
                    ? "Crear Entregable"
                    : `Crear ${quantity} piezas`}

              </button>

            </div>

          </div>

        </form>

      </div>
    </main>
  );
}

/*
 * =====================================
 * ESTILOS
 * =====================================
 */

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]";

/*
 * =====================================
 * FIELD
 * =====================================
 */

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

/*
 * =====================================
 * NOMBRE AUTOMÁTICO DE PIEZAS
 * =====================================
 */

function singularizeGroupName(
  name: string
) {
  if (!name) {
    return "Pieza";
  }

  const cleaned =
    name
      .replace(
        /^\d+\s+/,
        ""
      )
      .trim();

  const replacements: Record<
    string,
    string
  > = {
    Reels: "Reel",
    reels: "Reel",

    Videos: "Video",
    videos: "Video",

    Fotografías:
      "Fotografía",

    fotografías:
      "Fotografía",

    Fotos:
      "Foto",

    fotos:
      "Foto",

    Animaciones:
      "Animación",

    animaciones:
      "Animación",
  };

  return (
    replacements[
      cleaned
    ] ||
    cleaned ||
    "Pieza"
  );
}