import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FolderKanban,
  Pencil,
  UserRound,
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

        <section className="mt-6 rounded-xl border border-dashed border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-600">
              <FolderKanban size={18} />
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-300">
                Proyectos del cliente
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                En el próximo módulo vamos a mostrar acá todos los proyectos,
                trabajos y actividad relacionados con este cliente.
              </p>
            </div>
          </div>
        </section>
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