import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RelatedSection } from "@/app/related-records";
import { jobRows, loadJobRelations, requestRows } from "@/utils/related";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  FolderKanban,
  Pencil,
  UserRound,
} from "lucide-react";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectDetailPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      brief_description,
      notes,
      drive_url,
      created_at,
      closed_at,
      client_id,
      main_responsible_user_id,
      category_id,
      clients:client_id (
        name
      ),
      profiles:main_responsible_user_id (
        full_name
      ),
      project_categories:category_id (
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  const clientName = Array.isArray(project.clients)
    ? project.clients[0]?.name
    : (project.clients as { name?: string } | null)?.name;

  const responsibleName = Array.isArray(project.profiles)
    ? project.profiles[0]?.full_name
    : (project.profiles as { full_name?: string } | null)?.full_name;

  const categoryName = Array.isArray(project.project_categories)
    ? project.project_categories[0]?.name
    : (project.project_categories as { name?: string } | null)?.name;

  // Registros relacionados: trabajos y solicitudes del proyecto; piezas y producciones de esos trabajos.
  const [jobsResult, requestsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,name,status,general_deadline,project_id,profiles:responsible_user_id ( full_name )")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id,title,status,created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const jobs = jobsResult.data ?? [];
  const related = await loadJobRelations(supabase, jobs);
  const relatedError = Boolean(jobsResult.error || requestsResult.error || related.error);

  const statusLabel =
    project.status === "ACTIVE"
      ? "Activo"
      : project.status === "PAUSED"
      ? "Pausado"
      : project.status === "CLOSED"
      ? "Cerrado"
      : project.status;

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
        <Link
          href="/proyectos"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Proyectos
        </Link>

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <FolderKanban size={23} />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {project.name}
                </h1>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
                    project.status === "ACTIVE"
                      ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
                      : project.status === "PAUSED"
                      ? "border-amber-900/50 bg-amber-950/30 text-amber-400"
                      : "border-zinc-800 bg-zinc-900 text-zinc-500"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="text-sm text-zinc-500">
                {clientName ?? "Proyecto sin cliente"}
              </p>
            </div>
          </div>

          <Link
            href={`/proyectos/${project.id}/editar`}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <Pencil size={16} />
            Editar proyecto
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Información general
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Datos principales del proyecto dentro de AeroPro Desk.
              </p>
            </div>

            <div className="divide-y divide-white/5">
              <InfoRow
                label="Cliente"
                value={clientName ?? "Sin cliente"}
              />

              <InfoRow
                label="Categoría"
                value={categoryName ?? "Sin categoría"}
              />

              <InfoRow
                label="Responsable"
                value={responsibleName ?? "Sin responsable"}
              />

              <InfoRow
                label="Estado"
                value={statusLabel}
              />

              <div className="grid gap-2 px-6 py-5 sm:grid-cols-[180px_1fr]">
                <p className="text-sm text-zinc-600">
                  Drive
                </p>

                <div>
                  {project.drive_url ? (
                    <a
                      href={project.drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#45B8E8] transition hover:text-white"
                    >
                      Abrir carpeta de Drive
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Sin link cargado
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Responsable
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Seguimiento principal del proyecto.
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#20A4DD]/10 text-[#45B8E8]">
                  <UserRound size={18} />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {responsibleName ?? "Sin responsable"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Responsable principal
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Descripción
            </h2>
          </div>

          <div className="p-6">
            {project.brief_description ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {project.brief_description}
              </p>
            ) : (
              <p className="text-sm text-zinc-600">
                No hay una descripción cargada para este proyecto.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Observaciones
            </h2>
          </div>

          <div className="p-6">
            {project.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {project.notes}
              </p>
            ) : (
              <p className="text-sm text-zinc-600">
                No hay observaciones cargadas.
              </p>
            )}
          </div>
        </section>

        {relatedError && (
          <p className="mt-6 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            Parte de la información relacionada no se pudo cargar. Refrescá la página.
          </p>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <RelatedSection
            title="Trabajos"
            description="Trabajos de este proyecto. Los terminados aparecen al final."
            icon={<BriefcaseBusiness size={18} />}
            rows={jobRows(jobs)}
            emptyText="Todavía no hay trabajos en este proyecto."
            action={{ href: `/trabajos/nuevo?proyecto=${project.id}`, label: "Nuevo Trabajo" }}
          />

          <RelatedSection
            title="Piezas"
            description="Entregables de los trabajos del proyecto."
            icon={<ExternalLink size={18} />}
            rows={related.pieceRows}
            emptyText="Los trabajos de este proyecto todavía no tienen piezas."
          />

          <RelatedSection
            title="Producciones"
            description="Rodajes y jornadas vinculados a los trabajos del proyecto."
            icon={<FolderKanban size={18} />}
            rows={related.productionRows}
            emptyText="No hay producciones vinculadas a estos trabajos."
          />

          <RelatedSection
            title="Solicitudes"
            description="Pedidos asociados a este proyecto."
            icon={<Building2 size={18} />}
            rows={requestRows(requestsResult.data ?? [])}
            emptyText="No hay solicitudes asociadas a este proyecto."
          />
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 px-6 py-5 sm:grid-cols-[180px_1fr]">
      <p className="text-sm text-zinc-600">
        {label}
      </p>

      <p className="text-sm text-zinc-300">
        {value}
      </p>
    </div>
  );
}
