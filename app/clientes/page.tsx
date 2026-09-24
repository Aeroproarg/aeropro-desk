import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Search,
  Users,
} from "lucide-react";

export default async function ClientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      status,
      drive_url,
      notes,
      created_at,
      profiles:main_responsible_user_id (
        full_name
      )
    `)
    .order("name", { ascending: true });

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
                <Users size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Clientes
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Gestión general de clientes de AeroPro
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500">
              <Search size={17} />
              <span>Buscar cliente...</span>
            </div>

            <Link
              href="/clientes/nuevo"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus size={17} />
              Nuevo cliente
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar los clientes.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_120px] border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
              <div>Cliente</div>
              <div>Responsable</div>
              <div>Estado</div>
              <div>Drive</div>
              <div className="text-right">Acciones</div>
            </div>

            {!clients || clients.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                  <Users size={20} />
                </div>

                <p className="text-sm font-medium text-zinc-300">
                  Todavía no hay clientes
                </p>

                <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
                  Cuando cargues el primer cliente, va a aparecer acá junto con
                  su responsable, estado y acceso a Drive.
                </p>

                <Link
                  href="/clientes/nuevo"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#20A4DD] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  <Plus size={16} />
                  Crear primer cliente
                </Link>
              </div>
            ) : (
              <div>
                {clients.map((client: any) => {
                  const responsible =
                    client.profiles?.full_name ?? "Sin responsable";

                  const active = client.status === "ACTIVE";

                  return (
                    <div
                      key={client.id}
                      className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_120px] items-center border-b border-white/5 px-5 py-4 text-sm last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <div>
                        <Link
                          href={`/clientes/${client.id}`}
                          className="font-medium text-zinc-100 transition hover:text-[#45B8E8]"
                        >
                          {client.name}
                        </Link>

                        {client.notes && (
                          <p className="mt-1 max-w-md truncate text-xs text-zinc-600">
                            {client.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-zinc-400">
                        {responsible}
                      </div>

                      <div>
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

                      <div>
                        {client.drive_url ? (
                          <a
                            href={client.drive_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-white"
                          >
                            Abrir Drive
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-zinc-700">
                            Sin link
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <Link
                          href={`/clientes/${client.id}`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        >
                          Ver cliente
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