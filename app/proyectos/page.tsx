import { NoSearchResults, SearchBox, SearchSummary } from "@/app/search-box";
import { matchesSearch, readSearchQuery } from "@/utils/search";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  FolderKanban,
  Plus,
} from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = await readSearchQuery(searchParams);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      brief_description,
      drive_url,
      created_at,
      clients:client_id (
        name
      ),
      project_categories:category_id (
        name
      ),
      profiles:main_responsible_user_id (
        full_name
      )
    `)
    .order("created_at", { ascending: false });

  const visibleProjects = (projects ?? []).filter((item) =>
    matchesSearch(query, [item.name, item.brief_description, item.clients, item.project_categories, item.profiles])
  );

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Volver al Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
                <FolderKanban size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Proyectos
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Gestión general de proyectos de AeroPro
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBox
              action="/proyectos"
              query={query}
              placeholder="Buscar proyecto..."
              label="Buscar proyecto por nombre, cliente, categoría o responsable"
            />

            <Link
              href="/proyectos/nuevo"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus size={17} />
              Nuevo proyecto
            </Link>
          </div>
        </div>

        {!error && (
          <SearchSummary query={query} count={visibleProjects.length} singular="proyecto" plural="proyectos" clearHref="/proyectos" />
        )}

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar los proyectos.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="grid grid-cols-[1.5fr_1.2fr_1fr_1fr_0.8fr_120px] border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
              <div>Proyecto</div>
              <div>Cliente</div>
              <div>Categoría</div>
              <div>Responsable</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>

            {query && visibleProjects.length === 0 ? (
              <NoSearchResults query={query} />
            ) : visibleProjects.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                  <FolderKanban size={20} />
                </div>

                <p className="text-sm font-medium text-zinc-300">
                  Todavía no hay proyectos
                </p>

                <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
                  Cuando cargues el primer proyecto, va a aparecer acá junto
                  con su cliente, categoría, responsable y estado.
                </p>

                <Link
                  href="/proyectos/nuevo"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#20A4DD] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  <Plus size={16} />
                  Crear primer proyecto
                </Link>
              </div>
            ) : (
              <div>
                {visibleProjects.map((project: any) => {
                  const clientName = Array.isArray(project.clients)
                    ? project.clients[0]?.name
                    : project.clients?.name;

                  const categoryName = Array.isArray(
                    project.project_categories
                  )
                    ? project.project_categories[0]?.name
                    : project.project_categories?.name;

                  const responsibleName = Array.isArray(project.profiles)
                    ? project.profiles[0]?.full_name
                    : project.profiles?.full_name;

                  const statusLabel =
                    project.status === "ACTIVE"
                      ? "Activo"
                      : project.status === "PAUSED"
                      ? "Pausado"
                      : project.status === "CLOSED"
                      ? "Cerrado"
                      : project.status;

                  return (
                    <div
                      key={project.id}
                      className="grid grid-cols-[1.5fr_1.2fr_1fr_1fr_0.8fr_120px] items-center border-b border-white/5 px-5 py-4 text-sm last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <div>
                        <Link
                          href={`/proyectos/${project.id}`}
                          className="font-medium text-zinc-100 transition hover:text-[#45B8E8]"
                        >
                          {project.name}
                        </Link>

                        {project.brief_description && (
                          <p className="mt-1 max-w-md truncate text-xs text-zinc-600">
                            {project.brief_description}
                          </p>
                        )}
                      </div>

                      <div className="text-zinc-400">
                        {clientName ?? "Sin cliente"}
                      </div>

                      <div className="text-zinc-400">
                        {categoryName ?? "Sin categoría"}
                      </div>

                      <div className="text-zinc-400">
                        {responsibleName ?? "Sin responsable"}
                      </div>

                      <div>
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

                      <div className="text-right">
                        <Link
                          href={`/proyectos/${project.id}`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        >
                          Ver proyecto
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}