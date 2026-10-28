import { displayTimeZone } from "@/utils/dates";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Search,
} from "lucide-react";

export default async function RequestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: requests, error } = await supabase
    .from("requests")
    .select(`
      id,
      title,
      status,
      created_at,
      next_followup_at,
      confirmed_at,
      clients:client_id (
        name
      ),
      projects:project_id (
        name
      ),
      profiles:responsible_user_id (
        full_name
      ),
      request_source_channels:source_channel_id (
        name
      )
    `)
    .order("created_at", { ascending: false });

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
                <ClipboardList size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Solicitudes
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Pedidos, oportunidades y necesidades de clientes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500">
              <Search size={17} />
              Buscar solicitud...
            </div>

            <Link
              href="/solicitudes/nueva"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110"
            >
              <Plus size={17} />
              Nueva solicitud
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-300">
            No se pudieron cargar las solicitudes.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
            <div className="grid grid-cols-[1.5fr_1.1fr_1.1fr_1fr_1fr_0.9fr_120px] border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
              <div>Solicitud</div>
              <div>Cliente</div>
              <div>Proyecto</div>
              <div>Responsable</div>
              <div>Canal</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>

            {!requests || requests.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
                  <ClipboardList size={20} />
                </div>

                <p className="text-sm font-medium text-zinc-300">
                  Todavía no hay solicitudes
                </p>

                <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
                  Cuando cargues una solicitud, va a aparecer acá junto con
                  su cliente, proyecto, responsable, canal y estado.
                </p>

                <Link
                  href="/solicitudes/nueva"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#20A4DD] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  <Plus size={16} />
                  Crear primera solicitud
                </Link>
              </div>
            ) : (
              <div>
                {requests.map((request: any) => {
                  const clientName = Array.isArray(request.clients)
                    ? request.clients[0]?.name
                    : request.clients?.name;

                  const projectName = Array.isArray(request.projects)
                    ? request.projects[0]?.name
                    : request.projects?.name;

                  const responsibleName = Array.isArray(request.profiles)
                    ? request.profiles[0]?.full_name
                    : request.profiles?.full_name;

                  const channelName = Array.isArray(
                    request.request_source_channels
                  )
                    ? request.request_source_channels[0]?.name
                    : request.request_source_channels?.name;

                  return (
                    <div
                      key={request.id}
                      className="grid grid-cols-[1.5fr_1.1fr_1.1fr_1fr_1fr_0.9fr_120px] items-center border-b border-white/5 px-5 py-4 text-sm last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <div>
                        <Link
                          href={`/solicitudes/${request.id}`}
                          className="font-medium text-zinc-100 transition hover:text-[#45B8E8]"
                        >
                          {request.title}
                        </Link>

                        {request.next_followup_at && (
                          <p className="mt-1 text-xs text-zinc-600">
                            Próximo seguimiento:{" "}
                            {new Date(request.next_followup_at).toLocaleDateString("es-AR", { timeZone: displayTimeZone(request.next_followup_at) })}
                          </p>
                        )}
                      </div>

                      <div className="text-zinc-400">
                        {clientName ?? "Sin cliente"}
                      </div>

                      <div className="text-zinc-400">
                        {projectName ?? "Sin proyecto"}
                      </div>

                      <div className="text-zinc-400">
                        {responsibleName ?? "Sin responsable"}
                      </div>

                      <div className="text-zinc-400">
                        {channelName ?? "Sin canal"}
                      </div>

                      <div>
                        <RequestStatusBadge status={request.status} />
                      </div>

                      <div className="text-right">
                        <Link
                          href={`/solicitudes/${request.id}`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        >
                          Ver solicitud
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

function RequestStatusBadge({
  status,
}: {
  status: string;
}) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    NEW: {
      label: "Nueva",
      className:
        "border-[#20A4DD]/30 bg-[#20A4DD]/10 text-[#45B8E8]",
    },

    IN_DEFINITION: {
      label: "En definición",
      className:
        "border-violet-900/50 bg-violet-950/30 text-violet-400",
    },

    WAITING_CLIENT: {
      label: "Esperando cliente",
      className:
        "border-amber-900/50 bg-amber-950/30 text-amber-400",
    },

    CONFIRMED: {
      label: "Confirmada",
      className:
        "border-emerald-900/50 bg-emerald-950/30 text-emerald-400",
    },

    POSTPONED: {
      label: "Postergada",
      className:
        "border-orange-900/50 bg-orange-950/30 text-orange-400",
    },

    DID_NOT_ADVANCE: {
      label: "No avanzó",
      className:
        "border-zinc-800 bg-zinc-900 text-zinc-500",
    },

    CANCELLED: {
      label: "Cancelada",
      className:
        "border-red-900/50 bg-red-950/30 text-red-400",
    },
  };

  const current =
    config[status] ?? {
      label: status,
      className:
        "border-zinc-800 bg-zinc-900 text-zinc-500",
    };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${current.className}`}
    >
      {current.label}
    </span>
  );
}