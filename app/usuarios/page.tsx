import { NoSearchResults, SearchBox, SearchSummary } from "@/app/search-box";
import { matchesSearch, readSearchQuery } from "@/utils/search";
import { Fragment } from "react";
import Avatar from "@/app/avatar";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  History,
  Plus,
  UserCog,
} from "lucide-react";

export default async function UsersPage({
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

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      display_username,
      avatar_url,
      status,
      usual_specialty,
      availability,
      user_roles (
        roles (
          name
        )
      )
    `)
    .order("full_name", { ascending: true });

  const visibleProfiles = (profiles ?? []).filter((item) =>
    matchesSearch(query, [item.full_name, item.display_username, item.usual_specialty, item.user_roles])
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
                <UserCog size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Usuarios
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Equipo y accesos de AeroPro Desk
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">

            <SearchBox
              action="/usuarios"
              query={query}
              placeholder="Buscar usuario..."
              label="Buscar usuario por nombre, usuario, especialidad o rol"
            />

            <Link
              href="/actividad"
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-4 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <History size={17} />
              Actividad
            </Link>

            <Link
              href="/usuarios/nuevo"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus size={17} />
              Nuevo usuario
            </Link>

          </div>
        </div>

        {!error && (
          <SearchSummary query={query} count={visibleProfiles.length} singular="usuario" plural="usuarios" clearHref="/usuarios" />
        )}

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar los usuarios.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">

            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr] border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
              <div>Usuario</div>
              <div>Roles</div>
              <div>Especialidad</div>
              <div>Estado</div>
              <div>Disponibilidad</div>
            </div>

            {query && visibleProfiles.length === 0 ? (
              <NoSearchResults query={query} />
            ) : visibleProfiles.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">

                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                  <UserCog size={20} />
                </div>

                <p className="text-sm font-medium text-zinc-300">
                  No hay usuarios
                </p>

                <p className="mt-2 text-xs text-zinc-600">
                  Los miembros del equipo aparecerán acá.
                </p>

              </div>
            ) : (
              <div>
                {/* Activos primero; los dados de baja al final, separados y atenuados. */}
                {[...visibleProfiles]
                  .sort((a: any, b: any) => Number(a.status !== "ACTIVE") - Number(b.status !== "ACTIVE"))
                  .map((profile: any, index: number, sorted: any[]) => {

                  const roleNames =
                    profile.user_roles
                      ?.map((item: any) => item.roles?.name)
                      .filter(Boolean) ?? [];

                  const active = profile.status === "ACTIVE";

                  const available =
                    profile.availability === "AVAILABLE";

                  const firstInactive =
                    !active && (index === 0 || sorted[index - 1].status === "ACTIVE");

                  return (
                    <Fragment key={profile.id}>
                    {firstInactive && (
                      <div className="border-b border-white/10 bg-white/[0.02] px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                        Dados de baja · sin acceso a la plataforma
                      </div>
                    )}
                    <div
                      className={`grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr] items-center border-b border-white/5 px-5 py-4 text-sm last:border-b-0 hover:bg-white/[0.02] ${active ? "" : "opacity-50"}`}
                    >

                      <div className="flex items-center gap-3">
                        <Avatar name={profile.full_name} url={profile.avatar_url} size={36} />
                        <div>
                        <Link
                          href={`/usuarios/${profile.id}`}
                          className="font-medium text-zinc-100 transition hover:text-[#45B8E8]"
                        >
                          {profile.full_name}
                        </Link>

                        {profile.display_username && (
                          <p className="mt-1 text-xs text-zinc-600">
                            @{profile.display_username}
                          </p>
                        )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">

                        {roleNames.length > 0 ? (
                          roleNames.map((role: string) => (
                            <span
                              key={role}
                              className="rounded-full border border-[#20A4DD]/20 bg-[#20A4DD]/10 px-2 py-1 text-[10px] text-[#45B8E8]"
                            >
                              {formatRole(role)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-700">
                            Sin rol
                          </span>
                        )}

                      </div>

                      <div className="text-zinc-400">
                        {profile.usual_specialty || "Sin definir"}
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
                            active
                              ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
                              : "border-zinc-800 bg-zinc-900 text-zinc-500"
                          }`}
                        >
                          {active ? "Activo" : "Dado de baja"}
                        </span>
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
                            available
                              ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
                              : "border-amber-900/50 bg-amber-950/30 text-amber-400"
                          }`}
                        >
                          {available
                            ? "Disponible"
                            : "No disponible"}
                        </span>
                      </div>

                    </div>
                    </Fragment>
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

function formatRole(role: string) {
  const names: Record<string, string> = {
    RESPONSABLE_PROYECTO: "Responsable",
    COORDINACION: "Coordinación",
    PRODUCCION: "Producción",
    ADMINISTRACION: "Administración",
    EDITOR: "Edición",
    FREELANCE: "Freelance",
  };

  return names[role] ?? role;
}