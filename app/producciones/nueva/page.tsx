"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  MapPin,
  Save,
  UserRound,
  Video,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

const productionStatuses = [
  {
    value: "PENDING_PLANNING",
    label: "Pendiente de planificación",
  },
  {
    value: "PENDING_DATE",
    label: "Pendiente de fecha",
  },
  {
    value: "SCHEDULED",
    label: "Programada",
  },
  {
    value: "READY",
    label: "Lista para producir",
  },
];

export default function NewProductionPage() {
  const router = useRouter();

  const [
    profiles,
    setProfiles,
  ] = useState<Profile[]>([]);

  const [
    loadingProfiles,
    setLoadingProfiles,
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
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    responsibleUserId,
    setResponsibleUserId,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState(
    "PENDING_PLANNING"
  );

  const [
    startAt,
    setStartAt,
  ] = useState("");

  const [
    endAt,
    setEndAt,
  ] = useState("");

  const [
    location,
    setLocation,
  ] = useState("");

  const [
    preparationReviewAt,
    setPreparationReviewAt,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  /*
   * =====================================
   * CARGAR USUARIOS
   * =====================================
   */

  useEffect(() => {
    async function loadProfiles() {
      setLoadingProfiles(true);

      const {
        data,
        error,
      } = await supabase
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
        );

      if (error) {
        console.error(
          "Error loading profiles:",
          error
        );

        setErrorMessage(
          "No se pudieron cargar los responsables."
        );

        setLoadingProfiles(false);

        return;
      }

      setProfiles(
        (data ?? []) as Profile[]
      );

      setLoadingProfiles(false);
    }

    loadProfiles();
  }, []);

  /*
   * =====================================
   * GUARDAR
   * =====================================
   */

  async function handleSave() {
    if (saving) return;

    setErrorMessage("");

    /*
     * VALIDACIONES
     */

    if (!name.trim()) {
      setErrorMessage(
        "Escribí un nombre para la producción."
      );

      return;
    }

    if (!responsibleUserId) {
      setErrorMessage(
        "Elegí un responsable."
      );

      return;
    }

    if (
      status === "SCHEDULED" ||
      status === "READY"
    ) {
      if (!startAt) {
        setErrorMessage(
          "Una producción programada necesita fecha y hora de inicio."
        );

        return;
      }
    }

    if (
      startAt &&
      endAt &&
      new Date(endAt) <
        new Date(startAt)
    ) {
      setErrorMessage(
        "La fecha de fin no puede ser anterior al inicio."
      );

      return;
    }

    setSaving(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("productions")
        .insert({
          name:
            name.trim(),

          description:
            description.trim() ||
            null,

          responsible_user_id:
            responsibleUserId,

          status,

          start_at:
            startAt
              ? new Date(
                  startAt
                ).toISOString()
              : null,

          end_at:
            endAt
              ? new Date(
                  endAt
                ).toISOString()
              : null,

          location:
            location.trim() ||
            null,

          preparation_review_at:
            preparationReviewAt
              ? new Date(
                  preparationReviewAt
                ).toISOString()
              : null,

          notes:
            notes.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .select(`
          id
        `)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "No se pudo crear la producción."
        );
      }

      router.push(
        `/producciones/${data.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error creating production:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la producción."
      );

      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8">

          <Link
            href="/producciones"
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />

            Volver a Producciones
          </Link>

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <Video
                size={21}
              />
            </div>

            <div>

              <h1 className="text-2xl font-semibold tracking-tight">
                Nueva producción
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                Crear una nueva jornada o instancia de producción.
              </p>

            </div>

          </div>

        </div>

        {/* =====================================
            FORMULARIO
        ===================================== */}

        <div className="space-y-6">

          {/* =====================================
              INFORMACIÓN GENERAL
          ===================================== */}

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="border-b border-white/10 px-6 py-5">

              <h2 className="text-sm font-semibold">
                Información general
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Identificación principal de la producción.
              </p>

            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">

              {/* NOMBRE */}

              <Field
                label="Nombre de la producción"
                required
              >

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Botania · Jornada de rodaje 1"
                  className={inputClass}
                />

              </Field>

              {/* RESPONSABLE */}

              <Field
                label="Responsable"
                required
              >

                <div className="relative">

                  <UserRound
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
                  />

                  <select
                    value={
                      responsibleUserId
                    }
                    onChange={(e) =>
                      setResponsibleUserId(
                        e.target.value
                      )
                    }
                    disabled={
                      loadingProfiles
                    }
                    className={`${inputClass} pl-9`}
                  >
                    <option value="">
                      {loadingProfiles
                        ? "Cargando..."
                        : "Seleccionar responsable"}
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

                </div>

              </Field>

              {/* ESTADO */}

              <Field
                label="Estado"
                required
              >

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  {productionStatuses.map(
                    (item) => (
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

              </Field>

              {/* LUGAR */}

              <Field
                label="Lugar"
              >

                <div className="relative">

                  <MapPin
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"
                  />

                  <input
                    type="text"
                    value={location}
                    onChange={(e) =>
                      setLocation(
                        e.target.value
                      )
                    }
                    placeholder="Ej: Suipacha 1234, Rosario"
                    className={`${inputClass} pl-9`}
                  />

                </div>

              </Field>

              {/* DESCRIPCIÓN */}

              <div className="md:col-span-2">

                <Field
                  label="Descripción"
                >

                  <textarea
                    value={
                      description
                    }
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    rows={4}
                    placeholder="Breve descripción del objetivo de esta producción..."
                    className={`${inputClass} h-auto resize-none py-3`}
                  />

                </Field>

              </div>

            </div>

          </section>

          {/* =====================================
              FECHA Y HORARIO
          ===================================== */}

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="flex items-center gap-2">

                <CalendarClock
                  size={16}
                  className="text-[#45B8E8]"
                />

                <h2 className="text-sm font-semibold">
                  Fecha y horario
                </h2>

              </div>

              <p className="mt-1 text-xs text-zinc-600">
                Hacé clic en el campo para abrir el calendario.
              </p>

            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">

              <Field
                label="Inicio"
              >

                <DateTimeInput
                  value={startAt}
                  onChange={
                    setStartAt
                  }
                />

              </Field>

              <Field
                label="Fin estimado"
              >

                <DateTimeInput
                  value={endAt}
                  onChange={
                    setEndAt
                  }
                />

              </Field>

            </div>

          </section>

          {/* =====================================
              PREPARACIÓN
          ===================================== */}

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="flex items-center gap-2">

                <ClipboardCheck
                  size={16}
                  className="text-[#45B8E8]"
                />

                <h2 className="text-sm font-semibold">
                  Preparación
                </h2>

              </div>

              <p className="mt-1 text-xs text-zinc-600">
                Momento en que queremos revisar que la producción esté lista.
              </p>

            </div>

            <div className="grid gap-5 p-6">

              <Field
                label="Revisión de preparación"
              >

                <DateTimeInput
                  value={
                    preparationReviewAt
                  }
                  onChange={
                    setPreparationReviewAt
                  }
                />

              </Field>

              <Field
                label="Notas"
              >

                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(
                      e.target.value
                    )
                  }
                  rows={5}
                  placeholder="Indicaciones internas, accesos, permisos, referencias, horarios especiales..."
                  className={`${inputClass} h-auto resize-none py-3`}
                />

              </Field>

            </div>

          </section>

          {/* =====================================
              ERROR
          ===================================== */}

          {errorMessage && (
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* =====================================
              ACCIONES
          ===================================== */}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <Link
              href="/producciones"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </Link>

            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save
                size={16}
              />

              {saving
                ? "Creando..."
                : "Crear producción"}
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}

/*
 * =====================================
 * DATE / TIME PICKER
 * =====================================
 */

function DateTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  function openPicker(
    element: HTMLInputElement
  ) {
    try {
      if (
        typeof element.showPicker ===
        "function"
      ) {
        element.showPicker();
      }
    } catch {
      /*
       * Si algún navegador no permite
       * showPicker(), el input sigue
       * funcionando normalmente.
       */
    }
  }

  return (
    <div className="relative">

      <CalendarClock
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#45B8E8]"
      />

      <input
        type="datetime-local"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        onClick={(e) =>
          openPicker(
            e.currentTarget
          )
        }
        onFocus={(e) =>
          openPicker(
            e.currentTarget
          )
        }
        className={`${inputClass} cursor-pointer pl-9 pr-4 [color-scheme:dark]`}
      />

    </div>
  );
}

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

/*
 * =====================================
 * INPUT STYLE
 * =====================================
 */

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD] focus:ring-1 focus:ring-[#20A4DD]/20 disabled:cursor-not-allowed disabled:opacity-50";