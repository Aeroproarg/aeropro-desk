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
  Check,
  CheckCircle2,
  ClipboardCheck,
  Circle,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

export default function ProductionChecklistPage() {
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
    items,
    setItems,
  ] = useState<any[]>([]);

  /*
   * =====================================
   * FORM
   * =====================================
   */

  const [
    label,
    setLabel,
  ] = useState("");

  const [
    responsibleUserId,
    setResponsibleUserId,
  ] = useState("");

  const [
    comment,
    setComment,
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
      checklistResult,
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
        .from("production_checklist_items")
        .select(`
          id,
          production_id,
          label,
          status,
          responsible_user_id,
          comment,
          created_at,
          resolved_at,

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
        "No se pudieron cargar los responsables."
      );
    }

    if (checklistResult.error) {
      console.error(
        checklistResult.error
      );

      setErrorMessage(
        "No se pudo cargar el checklist."
      );
    }

    setProductionName(
      productionResult.data.name
    );

    setProfiles(
      (profilesResult.data ??
        []) as Profile[]
    );

    setItems(
      checklistResult.data ??
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
   * AGREGAR ITEM
   * =====================================
   */

  async function addItem() {
    if (saving) {
      return;
    }

    setErrorMessage("");

    if (!label.trim()) {
      setErrorMessage(
        "Escribí qué hay que controlar."
      );

      return;
    }

    setSaving(true);

    const {
      error,
    } = await supabase
      .from("production_checklist_items")
      .insert({
        production_id:
          productionId,

        label:
          label.trim(),

        status:
          "PENDING",

        responsible_user_id:
          responsibleUserId ||
          null,

        comment:
          comment.trim() ||
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

    setLabel("");
    setResponsibleUserId("");
    setComment("");

    await loadData();

    setSaving(false);

    router.refresh();
  }

  /*
   * =====================================
   * CAMBIAR ESTADO
   * =====================================
   */

  async function toggleItem(
    item: any
  ) {
    const isResolved =
      item.status ===
      "RESOLVED";

    const newStatus =
      isResolved
        ? "PENDING"
        : "RESOLVED";

    const {
      error,
    } = await supabase
      .from("production_checklist_items")
      .update({
        status:
          newStatus,

        resolved_at:
          newStatus ===
          "RESOLVED"
            ? new Date().toISOString()
            : null,
      })
      .eq(
        "id",
        item.id
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      return;
    }

    setItems(
      (current) =>
        current.map(
          (row) =>
            row.id ===
            item.id
              ? {
                  ...row,
                  status:
                    newStatus,
                  resolved_at:
                    newStatus ===
                    "RESOLVED"
                      ? new Date().toISOString()
                      : null,
                }
              : row
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * ELIMINAR
   * =====================================
   */

  async function removeItem(
    itemId: string
  ) {
    const confirmed =
      window.confirm(
        "¿Eliminar este ítem del checklist?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("production_checklist_items")
      .delete()
      .eq(
        "id",
        itemId
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      return;
    }

    setItems(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            itemId
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * MÉTRICAS
   * =====================================
   */

  const resolvedCount =
    items.filter(
      (item) =>
        item.status ===
        "RESOLVED"
    ).length;

  const progress =
    items.length > 0
      ? Math.round(
          (resolvedCount /
            items.length) *
            100
        )
      : 0;

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
            Cargando checklist...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">

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
              <ClipboardCheck
                size={21}
              />
            </div>

            <div>

              <h1 className="text-2xl font-semibold tracking-tight">
                Checklist de producción
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
            PROGRESO
        ===================================== */}

        <section className="mb-6 rounded-xl border border-white/10 bg-[#0B0F12] p-5">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm font-medium text-zinc-300">
                Preparación
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                {resolvedCount} de {items.length} resueltos
              </p>

            </div>

            <span className="text-sm font-semibold text-[#45B8E8]">
              {progress}%
            </span>

          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">

            <div
              className="h-full rounded-full bg-[#20A4DD] transition-all"
              style={{
                width:
                  `${progress}%`,
              }}
            />

          </div>

        </section>

        {/* =====================================
            AGREGAR
        ===================================== */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-3">

              <Plus
                size={17}
                className="text-[#45B8E8]"
              />

              <div>

                <h2 className="text-sm font-semibold">
                  Agregar control
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Algo que tiene que estar resuelto antes de producir.
                </p>

              </div>

            </div>

          </div>

          <div className="p-5">

            <div className="grid gap-4 md:grid-cols-2">

              <Field
                label="Ítem"
                required
              >
                <input
                  type="text"
                  value={
                    label
                  }
                  onChange={(e) =>
                    setLabel(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Baterías cargadas"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Responsable"
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
                    Sin responsable
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
                label="Comentario"
              >
                <textarea
                  value={comment}
                  onChange={(e) =>
                    setComment(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Ej: cargar también baterías del Ronin"
                  className={`${inputClass} h-auto resize-none py-3`}
                />
              </Field>

            </div>

            <div className="mt-4 flex justify-end">

              <button
                type="button"
                onClick={
                  addItem
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
                  : "Agregar al checklist"}
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
                Controles
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Estado de preparación de la jornada.
              </p>

            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
              {items.length}
            </span>

          </div>

          {items.length ===
          0 ? (

            <div className="px-6 py-12 text-center text-sm text-zinc-700">
              Todavía no hay controles cargados.
            </div>

          ) : (

            <div className="divide-y divide-white/5">

              {items.map(
                (item) => {

                  const resolved =
                    item.status ===
                    "RESOLVED";

                  const responsible =
                    firstRelation(
                      item.responsible
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-start gap-4 px-5 py-4"
                    >

                      <button
                        type="button"
                        onClick={() =>
                          toggleItem(
                            item
                          )
                        }
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                          resolved
                            ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
                            : "border-white/10 bg-[#050607] text-zinc-700 hover:border-[#20A4DD]/40 hover:text-[#45B8E8]"
                        }`}
                        title={
                          resolved
                            ? "Marcar como pendiente"
                            : "Marcar como resuelto"
                        }
                      >
                        {resolved ? (
                          <Check
                            size={14}
                          />
                        ) : (
                          <Circle
                            size={12}
                          />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <p
                            className={`text-sm ${
                              resolved
                                ? "text-zinc-500 line-through"
                                : "text-zinc-300"
                            }`}
                          >
                            {
                              item.label
                            }
                          </p>

                          {resolved && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/40 bg-emerald-950/20 px-2 py-0.5 text-[10px] text-emerald-400">
                              <CheckCircle2
                                size={10}
                              />

                              Resuelto
                            </span>
                          )}

                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-700">

                          {responsible?.full_name && (
                            <span>
                              Responsable:{" "}
                              {
                                responsible.full_name
                              }
                            </span>
                          )}

                          {item.comment && (
                            <span>
                              {
                                item.comment
                              }
                            </span>
                          )}

                        </div>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            item.id
                          )
                        }
                        title="Eliminar control"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-red-900/40 hover:bg-red-950/20 hover:text-red-400"
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
 * RELATION
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