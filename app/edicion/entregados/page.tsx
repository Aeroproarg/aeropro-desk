import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  CheckCircle2,
  CircleUserRound,
  ExternalLink,
  Film,
  History,
} from "lucide-react";

export default async function DeliveredPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================
   * PIEZAS ENTREGADAS
   * =====================================
   */

  const {
    data: deliveredPieces,
    error,
  } = await supabase
    .from("deliverables")
    .select(`
      id,
      job_id,
      group_id,
      name,
      status,
      deadline,
      editor_user_id,
      responsible_user_id,
      actual_first_cut_at,
      current_version,
      final_url,
      urgent,
      created_at,
      updated_at,

      editor:editor_user_id (
        id,
        full_name
      ),

      responsible:responsible_user_id (
        id,
        full_name
      ),

      jobs:job_id (
        id,
        name,

        projects:project_id (
          id,
          name,

          clients:client_id (
            id,
            name
          )
        )
      ),

      deliverable_groups:group_id (
        id,
        name
      )
    `)
    .eq("status", "DELIVERED")
    .order("updated_at", {
      ascending: false,
    });

  const pieces =
    deliveredPieces ?? [];

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">

        {/* =====================================
            CABECERA
        ===================================== */}

        <div className="mb-8">

          <Link
            href="/edicion"
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Volver a Edición
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-900/30 bg-emerald-950/20 text-emerald-400">
                <History size={21} />
              </div>

              <div>

                <h1 className="text-2xl font-semibold tracking-tight">
                  Entregados
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Historial de piezas finalizadas y entregadas.
                </p>

              </div>

            </div>

            <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-5 py-3">

              <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-600">
                Total entregadas
              </p>

              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {pieces.length}
              </p>

            </div>

          </div>

        </div>

        {/* =====================================
            ERROR
        ===================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudo cargar el historial de entregados.
          </div>
        )}

        {/* =====================================
            LISTADO
        ===================================== */}

        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-3">

              <CheckCircle2
                size={18}
                className="text-emerald-400"
              />

              <div>

                <h2 className="text-sm font-semibold">
                  Piezas entregadas
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Estas piezas ya no forman parte de la cola operativa.
                </p>

              </div>

            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
              {pieces.length}
            </span>

          </div>

          {pieces.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-zinc-700">
                <Film size={20} />
              </div>

              <p className="mt-4 text-sm text-zinc-500">
                Todavía no hay piezas entregadas.
              </p>

              <p className="mt-1 text-xs text-zinc-700">
                Cuando una pieza se marque como entregada, aparecerá acá.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <div className="min-w-[1150px]">

                {/* CABECERA TABLA */}

                <div className="grid grid-cols-[1.35fr_1fr_0.8fr_0.65fr_0.8fr_0.8fr_100px] border-b border-white/10 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-700">

                  <div>
                    Pieza
                  </div>

                  <div>
                    Cliente / Proyecto
                  </div>

                  <div>
                    Editor
                  </div>

                  <div>
                    Versión
                  </div>

                  <div>
                    Entregada
                  </div>

                  <div>
                    Archivo final
                  </div>

                  <div className="text-right">
                    Acción
                  </div>

                </div>

                {/* FILAS */}

                <div className="divide-y divide-white/5">

                  {pieces.map((piece) => {

                    const context =
                      getPieceContext(piece);

                    const editorName =
                      relationValue(
                        piece.editor,
                        "full_name"
                      );

                    const groupName =
                      relationValue(
                        piece.deliverable_groups,
                        "name"
                      );

                    return (
                      <div
                        key={piece.id}
                        className="grid grid-cols-[1.35fr_1fr_0.8fr_0.65fr_0.8fr_0.8fr_100px] items-center px-6 py-5 transition hover:bg-white/[0.02]"
                      >

                        {/* PIEZA */}

                        <div className="pr-5">

                          <div className="flex items-center gap-2">

                            <CheckCircle2
                              size={14}
                              className="shrink-0 text-emerald-500"
                            />

                            <Link
                              href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                              className="truncate text-sm font-medium text-zinc-200 transition hover:text-[#45B8E8]"
                            >
                              {piece.name}
                            </Link>

                          </div>

                          <p className="mt-1 truncate pl-[22px] text-xs text-zinc-700">
                            {groupName ?? "Sin grupo"}
                            {" · "}
                            {context.jobName}
                          </p>

                        </div>

                        {/* CLIENTE / PROYECTO */}

                        <div className="pr-5">

                          <p className="truncate text-xs text-zinc-400">
                            {context.clientName}
                          </p>

                          <p className="mt-1 truncate text-xs text-zinc-700">
                            {context.projectName}
                          </p>

                        </div>

                        {/* EDITOR */}

                        <div className="pr-5">

                          {editorName ? (

                            <div className="flex items-center gap-2">

                              <CircleUserRound
                                size={14}
                                className="text-zinc-600"
                              />

                              <span className="truncate text-xs text-zinc-400">
                                {editorName}
                              </span>

                            </div>

                          ) : (

                            <span className="text-xs text-zinc-700">
                              Sin editor
                            </span>

                          )}

                        </div>

                        {/* VERSION */}

                        <div>

                          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400">
                            V{piece.current_version ?? 1}
                          </span>

                        </div>

                        {/* FECHA */}

                        <div>

                          <p className="text-xs text-zinc-400">
                            {piece.updated_at
                              ? formatDate(piece.updated_at)
                              : "—"}
                          </p>

                          {piece.updated_at && (
                            <p className="mt-1 text-[10px] text-zinc-700">
                              {formatTime(piece.updated_at)}
                            </p>
                          )}

                        </div>

                        {/* LINK FINAL */}

                        <div>

                          {piece.final_url ? (

                            <a
                              href={piece.final_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[#45B8E8] transition hover:text-white"
                            >
                              <ExternalLink size={13} />
                              Abrir final
                            </a>

                          ) : (

                            <span className="text-xs text-zinc-700">
                              Sin link
                            </span>

                          )}

                        </div>

                        {/* ACCION */}

                        <div className="text-right">

                          <Link
                            href={`/trabajos/${piece.job_id}/entregables/${piece.id}`}
                            className="inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                          >
                            Ver
                          </Link>

                        </div>

                      </div>
                    );
                  })}

                </div>

              </div>

            </div>

          )}

        </section>

        {/* NOTA */}

        <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#080A0C] px-5 py-4">

          <p className="text-xs leading-relaxed text-zinc-600">
            Por ahora la fecha mostrada corresponde a la última actualización de la pieza,
            que coincide con el momento en que fue marcada como entregada. Más adelante
            vamos a registrar la fecha de entrega como dato independiente.
          </p>

        </div>

      </div>

    </main>
  );
}

/*
 * =====================================
 * CONTEXTO
 * =====================================
 */

function getPieceContext(
  piece: any
) {
  const jobName =
    relationValue(
      piece.jobs,
      "name"
    ) ?? "Sin Trabajo";

  const jobObject =
    Array.isArray(piece.jobs)
      ? piece.jobs[0]
      : piece.jobs;

  const projectRelation =
    jobObject &&
    typeof jobObject === "object"
      ? (
          jobObject as Record<
            string,
            unknown
          >
        ).projects
      : null;

  const projectName =
    relationValue(
      projectRelation,
      "name"
    ) ?? "Sin proyecto";

  const projectObject =
    Array.isArray(projectRelation)
      ? projectRelation[0]
      : projectRelation;

  const clientRelation =
    projectObject &&
    typeof projectObject === "object"
      ? (
          projectObject as Record<
            string,
            unknown
          >
        ).clients
      : null;

  const clientName =
    relationValue(
      clientRelation,
      "name"
    ) ?? "Sin cliente";

  return {
    jobName,
    projectName,
    clientName,
  };
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

function relationValue(
  relation: unknown,
  property: string
): string | undefined {
  if (!relation) {
    return undefined;
  }

  if (Array.isArray(relation)) {
    const first =
      relation[0] as
        | Record<string, unknown>
        | undefined;

    const value =
      first?.[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  if (
    typeof relation === "object"
  ) {
    const value = (
      relation as Record<
        string,
        unknown
      >
    )[property];

    return typeof value === "string"
      ? value
      : undefined;
  }

  return undefined;
}

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
}

function formatTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleTimeString(
    "es-AR",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}