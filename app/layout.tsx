import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/utils/supabase/server";
import AppNav, { type NavLink } from "./app-nav";
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

// La barra de navegación aparece en todas las pantallas cuando hay una sesión iniciada.
async function Navigation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: userRoles }, { data: canViewActivity }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
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

  return <AppNav links={links} userName={userName} roleLabel={roleLabel} initials={initials} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050607]">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
