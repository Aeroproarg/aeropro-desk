import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "./logout-button";

import {
  Bell,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PackageCheck,
  Search,
  Settings,
  Users,
  Video,
  WandSparkles,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Solicitudes", icon: ClipboardList },
  { label: "Proyectos", icon: FolderKanban },
  { label: "Trabajos", icon: WandSparkles },
  { label: "Producciones", icon: Video },
  { label: "Edición", icon: PackageCheck },
  { label: "Calendario", icon: CalendarDays },
  { label: "Clientes", icon: Users },
];

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select(`
      roles (
        name
      )
    `)
    .eq("user_id", user.id);

  const roleNames =
    userRoles
      ?.map((item: any) => item.roles?.name)
      .filter(Boolean) ?? [];

  const displayRole =
    roleNames.includes("COORDINACION")
      ? "Coordinación"
      : roleNames.includes("RESPONSABLE_PROYECTO")
      ? "Responsable de proyecto"
      : roleNames.includes("PRODUCCION")
      ? "Producción"
      : roleNames.includes("ADMINISTRACION")
      ? "Administración"
      : roleNames.includes("EDITOR")
      ? "Edición"
      : roleNames.includes("FREELANCE")
      ? "Freelance"
      : "Usuario";

  const initials = (profile?.full_name ?? "AD")
    .split(" ")
    .map((word: string) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[250px] shrink-0 border-r border-white/10 bg-[#080A0C] lg:flex lg:flex-col">
          <div className="flex h-20 items-center border-b border-white/10 px-6">
            <div>
              <div className="text-2xl font-semibold tracking-tight">
                Aero<span className="text-[#20A4DD]">Pro</span>
              </div>

              <div className="mt-0.5 text-[10px] font-medium tracking-[0.28em] text-zinc-500">
                DESK
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-5">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      item.active
                        ? "bg-[#20A4DD]/10 text-[#45B8E8]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/10 p-3">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
              <Settings size={18} strokeWidth={1.8} />
              Configuración
            </button>

            <LogoutButton />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-white/10 bg-[#080A0C]/80 px-5 backdrop-blur-xl md:px-8">
            <div className="flex items-center gap-4">
              <button className="rounded-lg border border-white/10 p-2 text-zinc-400 lg:hidden">
                <Menu size={20} />
              </button>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Dashboard
                </h1>

                <p className="mt-1 hidden text-sm text-zinc-500 sm:block">
                  Resumen operativo de AeroPro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-zinc-500 transition hover:border-white/20 hover:text-white md:flex">
                <Search size={17} />

                <span>Buscar...</span>

                <span className="ml-8 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600">
                  Ctrl K
                </span>
              </button>

              <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white">
                <Bell size={18} />

                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#20A4DD]" />
              </button>

              <div className="ml-2 hidden items-center gap-3 border-l border-white/10 pl-4 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#20A4DD]/15 text-sm font-semibold text-[#45B8E8]">
                  {initials}
                </div>

                <div className="hidden xl:block">
                  <p className="text-sm font-medium">
                    {profile?.full_name ?? "Usuario"}
                  </p>

                  <p className="text-xs text-zinc-600">
                    {displayRole}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 md:py-8">
            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#20A4DD]">
                    Hoy
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Panorama operativo
                  </h2>
                </div>

                <p className="hidden text-sm text-zinc-600 md:block">
                  Todo lo que requiere atención hoy
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Producciones"
                  value="0"
                  description="programadas para hoy"
                  icon={<Video size={20} />}
                />

                <StatCard
                  label="Entregas"
                  value="0"
                  description="con deadline hoy"
                  icon={<PackageCheck size={20} />}
                />

                <StatCard
                  label="Reuniones"
                  value="0"
                  description="en agenda"
                  icon={<CalendarDays size={20} />}
                />

                <StatCard
                  label="Pendientes"
                  value="0"
                  description="requieren atención"
                  icon={<ClipboardList size={20} />}
                />
              </div>
            </section>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Requieren atención"
                subtitle="Alertas y pendientes operativos"
              >
                <EmptyState
                  title="Todo bajo control"
                  text="No hay alertas ni pendientes urgentes en este momento."
                />
              </Panel>

              <Panel
                title="Próximos 7 días"
                subtitle="Agenda operativa"
              >
                <EmptyState
                  title="Sin actividades próximas"
                  text="Las producciones, reuniones y entregas aparecerán acá."
                />
              </Panel>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Panel
                title="Edición"
                subtitle="Estado general de postproducción"
              >
                <div className="grid grid-cols-3 gap-3">
                  <MiniMetric
                    label="Sin asignar"
                    value="0"
                  />

                  <MiniMetric
                    label="En edición"
                    value="0"
                  />

                  <MiniMetric
                    label="En revisión"
                    value="0"
                  />
                </div>
              </Panel>

              <Panel
                title="Producción y material"
                subtitle="Seguimiento de rodajes y backups"
              >
                <div className="grid grid-cols-3 gap-3">
                  <MiniMetric
                    label="Por descargar"
                    value="0"
                  />

                  <MiniMetric
                    label="Backup pendiente"
                    value="0"
                  />

                  <MiniMetric
                    label="Próximas"
                    value="0"
                  />
                </div>
              </Panel>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F12] p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
          {icon}
        </div>

        <span className="text-3xl font-semibold tracking-tight">
          {value}
        </span>
      </div>

      <p className="mt-6 text-sm font-medium">
        {label}
      </p>

      <p className="mt-1 text-xs text-zinc-600">
        {description}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0B0F12]">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-sm font-semibold">
          {title}
        </h3>

        <p className="mt-1 text-xs text-zinc-600">
          {subtitle}
        </p>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-5 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.03] text-zinc-600">
        <ClipboardList size={17} />
      </div>

      <p className="text-sm font-medium text-zinc-300">
        {title}
      </p>

      <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">
        {text}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#07090B] p-4">
      <p className="text-2xl font-semibold">
        {value}
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        {label}
      </p>
    </div>
  );
}