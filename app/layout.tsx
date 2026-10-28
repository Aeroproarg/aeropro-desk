import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/utils/supabase/server";
import AppNav, { type NavLink } from "./app-nav";
import LogoutButton from "./logout-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AeroPro Desk",
  description: "Gestión operativa de AeroPro",
};

const NAV_LINKS: NavLink[] = [
  { label: "Inicio", href: "/" },
  { label: "Solicitudes", href: "/solicitudes" },
  { label: "Proyectos", href: "/proyectos" },
  { label: "Trabajos", href: "/trabajos" },
  { label: "Producciones", href: "/producciones" },
  { label: "Edición", href: "/edicion" },
  { label: "Clientes", href: "/clientes" },
  { label: "Usuarios", href: "/usuarios" },
];

const ROLE_LABELS: [string, string][] = [
  ["COORDINACION", "Coordinación"],
  ["RESPONSABLE_PROYECTO", "Responsable de proyecto"],
  ["PRODUCCION", "Producción"],
  ["ADMINISTRACION", "Administración"],
  ["EDITOR", "Edición"],
  ["FREELANCE", "Freelance"],
];

// Sesión actual: datos para la barra de navegación y control de usuarios dados de baja.
async function loadSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: userRoles }, { data: canViewActivity }] = await Promise.all([
    supabase.from("profiles").select("full_name,status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("roles ( name )").eq("user_id", user.id),
    supabase.rpc("can_view_activity"),
  ]);

  const roleNames: string[] =
    userRoles?.map((item: any) => item.roles?.name).filter(Boolean) ?? [];
  const roleLabel = ROLE_LABELS.find(([code]) => roleNames.includes(code))?.[1] ?? "Usuario";
  const userName = profile?.full_name ?? user.email ?? "Usuario";
  const initials = userName
    .split(" ")
    .map((word: string) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const links = canViewActivity === true ? [...NAV_LINKS, { label: "Actividad", href: "/actividad" }] : NAV_LINKS;

  return { links, userName, roleLabel, initials, inactive: profile?.status === "INACTIVE" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await loadSession();

  // Usuario dado de baja con una sesión todavía abierta: no se muestra ninguna pantalla.
  if (session?.inactive) {
    return (
      <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="flex min-h-full items-center justify-center bg-[#050607] px-5 text-white">
          <div className="max-w-sm rounded-xl border border-white/10 bg-[#0B0F12] p-6 text-center">
            <p className="text-lg font-semibold">Tu acceso fue dado de baja</p>
            <p className="mt-2 text-sm text-zinc-400">Si creés que es un error, hablá con Coordinación o Administración.</p>
            <div className="mt-4 flex justify-center">
              <LogoutButton compact />
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050607]">
        {session && (
          <AppNav links={session.links} userName={session.userName} roleLabel={session.roleLabel} initials={session.initials} />
        )}
        {children}
      </body>
    </html>
  );
}
