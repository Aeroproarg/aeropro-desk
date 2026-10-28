import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RelatedSection } from "@/app/related-records";
import { jobRows, loadJobRelations, requestRows } from "@/utils/related";
import { CLOSED_STATUSES, statusLabel } from "@/utils/status-labels";

import {
  ArrowLeft,
  Building2,
  ExternalLink,
  BriefcaseBusiness,
  ClipboardList,
  FolderKanban,
  PackageCheck,
  Pencil,
  UserRound,
  Video,
} from "lucide-react";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientDetailPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      status,
      drive_url,
      notes,
      created_at,
      inactive_at,
      main_responsible_user_id,
      profiles:main_responsible_user_id (
        full_name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !client) {
    notFound();
  }

const responsible = Array.isArray(client.profiles)
  ? client.profiles[0]?.full_name
  : (client.profiles as { full_name?: string } | null)?.full_name;

  const active = client.status === "ACTIVE";

  // Registros relacionados: proyectos y solicitudes del cliente; trabajos de esos proyectos, sus piezas y producciones.
  const [projectsResult, requestsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,status,brief_description")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id,title,status,created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const projects = projectsResult.data ?? [];
  const projectNames = new Map(projects.map((project) => [project.id as string, project.name as string]));
  const jobsResult = projects.length
    ? await supabase
        .from("jobs")
        .select("id,name,status,general_deadline,project_id,profiles:responsible_user_id ( full_name )")
        .in("project_id", projects.map((project) => project.id))
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const jobs = jobsResult.data ?? [];
  const related = await loadJobRelations(supabase, jobs);
  const relatedError = Boolean(projectsResult.error || requestsResult.error || jobsResult.error || related.error);
  const projectRows = projects
    .map((project) => ({
      key: project.id,
      href: `/proyectos/${project.id}`,
      title: project.name,
      subtitle: project.brief_description ?? undefined,
      status: statusLabel("project", project.status),
      closed: CLOSED_STATUSES.project.includes(project.status),
    }))
    .sort((a, b) => Number(a.closed) - Number(b.closed));

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
        <Link
          href="/clientes"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Clientes
        </Link>

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <Building2 size={23} />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {client.name}
                </h1>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
                    active
                      ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
                      : "border-zinc-800 bg-zinc-900 text-zinc-500"
                  }`}
                >
                  {active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="text-sm text-zinc-500">
                Ficha general del cliente
              </p>
            </div>
          </div>

          <Link
            href={`/clientes/${client.id}/editar`}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <Pencil size={16} />
            Editar cliente
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold">
                Información general
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Datos principales del cliente dentro de AeroPro Desk.
              </p>
            </div>

            <div className="divide-y divide-white/5">
              <InfoRow
                label="Nombre"
                value={client.name}
              />

              <InfoRow
                label="Responsable principal"
                value={responsible ?? "Sin responsable"}
              />

              <InfoRow
                label="Estado"
                value={active ? "Activo" : "Inactivo"}
              />

              <div className="grid gap-2 px-6 py-5 sm:grid-cols-[180px_1fr]">
                <p className="text-sm text-zinc-600">
                  Drive principal
                </p>

                <div>
                  {client.drive_url ? (
                    <a
                      href={client.drive_url}
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
                Seguimiento principal del cliente.
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#20A4DD]/10 text-[#45B8E8]">
                  <UserRound size={18} />
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {responsible ?? "Sin responsable"}
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
              Observaciones
            </h2>
          </div>

          <div className="p-6">
            {client.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {client.notes}
              </p>
            ) : (
              <p className="text-sm text-zinc-600">
                No hay observaciones cargadas para este cliente.
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
            title="Proyectos"
            description="Proyectos de este cliente."
            icon={<FolderKanban size={18} />}
            rows={projectRows}
            emptyText="Este cliente todavía no tiene proyectos."
            action={{ href: "/proyectos/nuevo", label: "Nuevo proyecto" }}
          />

          <RelatedSection
            title="Trabajos"
            description="Trabajos de todos sus proyectos."
            icon={<BriefcaseBusiness size={18} />}
            rows={jobRows(jobs, projectNames)}
            emptyText="Todavía no hay trabajos para este cliente."
          />

          <RelatedSection
            title="Piezas"
            description="Entregables de sus trabajos. Las cerradas aparecen al final."
            icon={<PackageCheck size={18} />}
            rows={related.pieceRows}
            emptyText="Todavía no hay piezas para este cliente."
          />

          <RelatedSection
            title="Producciones"
            description="Rodajes y jornadas vinculados a sus trabajos."
            icon={<Video size={18} />}
            rows={related.productionRows}
            emptyText="No hay producciones vinculadas a este cliente."
          />

          <RelatedSection
            title="Solicitudes"
            description="Pedidos y oportunidades del cliente."
            icon={<ClipboardList size={18} />}
            rows={requestRows(requestsResult.data ?? [])}
            emptyText="No hay solicitudes de este cliente."
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