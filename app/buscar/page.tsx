import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { SearchBox } from "@/app/search-box";
import { matchesSearch, readSearchQuery } from "@/utils/search";
import { statusLabel } from "@/utils/status-labels";

// Buscador general: busca en todas las secciones a la vez (sin tildes ni mayúsculas).
// Cada persona ve solo lo que sus permisos le permiten.

type Row = Record<string, any>;
type Result = { key: string; href: string; title: string; subtitle?: string; status?: string };

const PER_SECTION = 8;

function relationName(relation: unknown, field = "name"): string | undefined {
  const value = Array.isArray(relation) ? relation[0] : relation;
  if (!value || typeof value !== "object") return undefined;
  const result = (value as Record<string, unknown>)[field];
  return result == null ? undefined : String(result);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = await readSearchQuery(searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let sections: { title: string; results: Result[]; total: number }[] = [];

  if (query.length >= 2) {
    const [clients, projects, requests, jobs, pieces, productions, people] = await Promise.all([
      supabase.from("clients").select("id,name,notes,status"),
      supabase.from("projects").select("id,name,brief_description,status,clients:client_id ( name )"),
      supabase.from("requests").select("id,title,status,clients:client_id ( name )"),
      supabase.from("jobs").select("id,name,status,projects:project_id ( name, clients:client_id ( name ) )"),
      supabase.from("deliverables").select("id,job_id,name,status,jobs:job_id ( name )"),
      supabase.from("productions").select("id,name,location,status,start_at"),
      supabase.from("profiles").select("id,full_name,display_username,usual_specialty,status"),
    ]);

    const pick = (rows: Row[] | null, fields: (row: Row) => unknown[], toResult: (row: Row) => Result) => {
      const matches = (rows ?? []).filter((row) => matchesSearch(query, fields(row)));
      return { results: matches.slice(0, PER_SECTION).map(toResult), total: matches.length };
    };

    sections = [
      {
        title: "Clientes",
        ...pick(clients.data, (r) => [r.name, r.notes], (r) => ({
          key: r.id, href: `/clientes/${r.id}`, title: r.name, status: r.status === "ACTIVE" ? "Activo" : "Inactivo",
        })),
      },
      {
        title: "Proyectos",
        ...pick(projects.data, (r) => [r.name, r.brief_description, r.clients], (r) => ({
          key: r.id, href: `/proyectos/${r.id}`, title: r.name, subtitle: relationName(r.clients),
          status: statusLabel("project", r.status),
        })),
      },
      {
        title: "Solicitudes",
        ...pick(requests.data, (r) => [r.title, r.clients], (r) => ({
          key: r.id, href: `/solicitudes/${r.id}`, title: r.title, subtitle: relationName(r.clients),
          status: statusLabel("request", r.status),
        })),
      },
      {
        title: "Trabajos",
        ...pick(jobs.data, (r) => [r.name, r.projects], (r) => {
          const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
          return {
            key: r.id, href: `/trabajos/${r.id}`, title: r.name,
            subtitle: [project?.name, relationName(project?.clients)].filter(Boolean).join(" · ") || undefined,
            status: statusLabel("job", r.status),
          };
        }),
      },
      {
        title: "Piezas",
        ...pick(pieces.data, (r) => [r.name, r.jobs], (r) => ({
          key: r.id, href: r.job_id ? `/trabajos/${r.job_id}/entregables/${r.id}` : "/edicion", title: r.name,
          subtitle: relationName(r.jobs), status: statusLabel("piece", r.status),
        })),
      },
      {
        title: "Producciones",
        ...pick(productions.data, (r) => [r.name, r.location], (r) => ({
          key: r.id, href: `/producciones/${r.id}`, title: r.name, subtitle: r.location ?? undefined,
          status: statusLabel("production", r.status),
        })),
      },
      {
        title: "Personas",
        ...pick(people.data, (r) => [r.full_name, r.display_username, r.usual_specialty], (r) => ({
          key: r.id, href: `/usuarios/${r.id}`, title: r.full_name,
          subtitle: [r.display_username ? `@${r.display_username}` : null, r.usual_specialty].filter(Boolean).join(" · ") || undefined,
          status: r.status === "ACTIVE" ? undefined : "Dado de baja",
        })),
      },
    ];
  }

  const found = sections.filter((section) => section.total > 0);
  const totalFound = found.reduce((sum, section) => sum + section.total, 0);

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <Search size={21} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
              <p className="mt-1 text-sm text-zinc-500">Clientes, proyectos, solicitudes, trabajos, piezas, producciones y personas.</p>
            </div>
          </div>
          <SearchBox action="/buscar" query={query} placeholder="Buscar en todo..." label="Buscar en toda la plataforma" />
        </div>

        {!query ? (
          <p className="rounded-xl border border-white/10 bg-[#0B0F12] p-6 text-sm text-zinc-400">
            Escribí una palabra y apretá Enter. No importan las tildes ni las mayúsculas.
          </p>
        ) : query.length < 2 ? (
          <p className="rounded-xl border border-white/10 bg-[#0B0F12] p-6 text-sm text-zinc-400">Escribí al menos 2 letras.</p>
        ) : found.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-[#0B0F12] p-6 text-sm text-zinc-400">
            No hay resultados para “{query}”. Probá con otra palabra o revisá cómo está escrita.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              {totalFound === 1 ? "1 resultado" : `${totalFound} resultados`} para “{query}”.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {found.map((section) => (
                <section key={section.title} className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
                  <h2 className="border-b border-white/10 px-5 py-3 text-sm font-semibold">
                    {section.title} <span className="ml-1 text-xs font-normal text-zinc-500">{section.total}</span>
                  </h2>
                  <ul className="divide-y divide-white/5">
                    {section.results.map((result) => (
                      <li key={result.key}>
                        <Link href={result.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-200">{result.title}</span>
                            {result.subtitle && <span className="block truncate text-xs text-zinc-500">{result.subtitle}</span>}
                          </span>
                          {result.status && (
                            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-zinc-400">
                              {result.status}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {section.total > section.results.length && (
                    <p className="border-t border-white/5 px-5 py-2 text-xs text-zinc-600">
                      Y {section.total - section.results.length} más. Usá el buscador de esa sección para verlos todos.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
