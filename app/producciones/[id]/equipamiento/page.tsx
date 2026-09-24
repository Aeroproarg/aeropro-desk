"use client";

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
  Camera,
  CircleUserRound,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

export default function ProductionEquipmentPage() {
  const params = useParams();
  const router = useRouter();

  const productionId =
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
    productionName,
    setProductionName,
  ] = useState("");

  const [
    profiles,
    setProfiles,
  ] = useState<Profile[]>([]);

  const [
    equipment,
    setEquipment,
  ] = useState<any[]>([]);

  /*
   * =====================================
   * FORM
   * =====================================
   */

  const [
    itemName,
    setItemName,
  ] = useState("");

  const [
    usedByUserId,
    setUsedByUserId,
  ] = useState("");

  const [
    preparedByUserId,
    setPreparedByUserId,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  /*
   * =====================================
   * CARGAR DATOS
   * =====================================
   */

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [
      productionResult,
      profilesResult,
      equipmentResult,
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
        .from("production_equipment")
        .select(`
          id,
          production_id,
          item_name,
          used_by_user_id,
          prepared_by_user_id,
          notes,
          created_at,

          used_by:used_by_user_id (
            id,
            full_name
          ),

          prepared_by:prepared_by_user_id (
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
    ]);

    if (
      productionResult.error ||
      !productionResult.data
    ) {
      console.error(
        productionResult.error
      );

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
        "No se pudo cargar el equipo de AeroPro."
      );
    }

    if (equipmentResult.error) {
      console.error(
        equipmentResult.error
      );

      setErrorMessage(
        "No se pudo cargar el equipamiento."
      );
    }

    setProductionName(
      productionResult.data.name
    );

    setProfiles(
      (profilesResult.data ??
        []) as Profile[]
    );

    setEquipment(
      equipmentResult.data ??
        []
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
   * AGREGAR EQUIPO
   * =====================================
   */

  async function addEquipment() {
    if (saving) {
      return;
    }

    setErrorMessage("");

    if (!itemName.trim()) {
      setErrorMessage(
        "Escribí qué equipo querés agregar."
      );

      return;
    }

    setSaving(true);

    const {
      error,
    } = await supabase
      .from("production_equipment")
      .insert({
        production_id:
          productionId,

        item_name:
          itemName.trim(),

        used_by_user_id:
          usedByUserId ||
          null,

        prepared_by_user_id:
          preparedByUserId ||
          null,

        notes:
          notes.trim() ||
          null,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    setItemName("");
    setUsedByUserId("");
    setPreparedByUserId("");
    setNotes("");

    await loadData();

    setSaving(false);

    router.refresh();
  }

  /*
   * =====================================
   * ELIMINAR EQUIPO
   * =====================================
   */

  async function removeEquipment(
    equipmentId: string
  ) {
    const confirmed =
      window.confirm(
        "¿Quitar este equipo de la producción?"
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const {
      error,
    } = await supabase
      .from("production_equipment")
      .delete()
      .eq(
        "id",
        equipmentId
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      return;
    }

    setEquipment(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            equipmentId
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * LOADING
   * =====================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">

        <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-6 py-10 text-center text-sm text-zinc-600">
            Cargando equipamiento...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
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
              <Camera
                size={21}
              />
            </div>

            <div>

              <h1 className="text-2xl font-semibold tracking-tight">
                Equipamiento
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {productionName}
              </p>

            </div>

          </div>

        </div>

        {/* =====================================
            ERROR
        ===================================== */}

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* =====================================
            CARGA
        ===================================== */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-3">

              <Camera
                size={17}
                className="text-[#45B8E8]"
              />

              <div>

                <h2 className="text-sm font-semibold">
                  Agregar equipamiento
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Equipo técnico necesario para esta producción.
                </p>

              </div>

            </div>

          </div>

          <div className="p-5">

            <div className="grid gap-4 md:grid-cols-3">

              <Field
                label="Equipo"
                required
              >
                <input
                  type="text"
                  value={
                    itemName
                  }
                  onChange={(e) =>
                    setItemName(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Sony FX3"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Lo usa"
              >
                <select
                  value={
                    usedByUserId
                  }
                  onChange={(e) =>
                    setUsedByUserId(
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
                label="Lo prepara"
              >
                <select
                  value={
                    preparedByUserId
                  }
                  onChange={(e) =>
                    setPreparedByUserId(
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

            </div>

            <div className="mt-4">

              <Field
                label="Nota"
              >
                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Ej: llevar 3 baterías, filtro ND, tarjeta extra..."
                  className={`${inputClass} h-auto resize-none py-3`}
                />
              </Field>

            </div>

            <div className="mt-4 flex justify-end">

              <button
                type="button"
                onClick={
                  addEquipment
                }
                disabled={
                  saving
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus
                  size={15}
                />

                {saving
                  ? "Agregando..."
                  : "Agregar equipo"}
              </button>

            </div>

          </div>

        </section>

        {/* =====================================
            LISTADO
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

            <div>

              <h2 className="text-sm font-semibold">
                Equipo cargado
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Equipamiento previsto para la jornada.
              </p>

            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
              {equipment.length}
            </span>

          </div>

          {equipment.length ===
          0 ? (

            <div className="px-6 py-12 text-center text-sm text-zinc-700">
              Todavía no hay equipamiento cargado.
            </div>

          ) : (

            <div className="divide-y divide-white/5">

              {equipment.map(
                (item) => {

                  const usedBy =
                    firstRelation(
                      item.used_by
                    );

                  const preparedBy =
                    firstRelation(
                      item.prepared_by
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_0.9fr_0.9fr_auto] md:items-center"
                    >

                      <div>

                        <div className="flex items-center gap-3">

                          <Camera
                            size={16}
                            className="shrink-0 text-zinc-600"
                          />

                          <p className="text-sm font-medium text-zinc-300">
                            {
                              item.item_name
                            }
                          </p>

                        </div>

                        {item.notes && (
                          <p className="mt-2 pl-7 text-xs leading-relaxed text-zinc-600">
                            {
                              item.notes
                            }
                          </p>
                        )}

                      </div>

                      <PersonInfo
                        label="Lo usa"
                        name={
                          usedBy?.full_name ??
                          "Sin definir"
                        }
                      />

                      <PersonInfo
                        label="Lo prepara"
                        name={
                          preparedBy?.full_name ??
                          "Sin definir"
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeEquipment(
                            item.id
                          )
                        }
                        title="Quitar equipamiento"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-red-900/40 hover:bg-red-950/20 hover:text-red-400"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

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
 * PERSONA
 * =====================================
 */

function PersonInfo({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <div>

      <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">

        <CircleUserRound
          size={13}
          className="text-zinc-700"
        />

        <p className="text-xs text-zinc-400">
          {name}
        </p>

      </div>

    </div>
  );
}

/*
 * =====================================
 * RELACIONES
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

/*
 * =====================================
 * STYLES
 * =====================================
 */

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD] focus:ring-1 focus:ring-[#20A4DD]/20";