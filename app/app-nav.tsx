"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, Search } from "lucide-react";
import LogoutButton from "./logout-button";
import Avatar from "./avatar";
import Logo from "./logo";

// Barra fija común a toda la plataforma: el logo y "Inicio" llevan siempre al Dashboard.

export type NavLink = { label: string; href: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav({
  links,
  userName,
  roleLabel,
  avatarUrl,
}: {
  links: NavLink[];
  userName: string;
  roleLabel: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);

  // Al navegar desde el menú del celular, se cierra solo.
  useEffect(() => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);

  if (pathname === "/login") return null;

  const linkClass = (href: string) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
      isActive(pathname, href) ? "bg-[#20A4DD]/10 text-[#45B8E8]" : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080A0C]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5 md:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Ir al inicio (Dashboard)">
          <Logo height={20} />
          <span className="ml-2 text-[9px] font-medium tracking-[0.28em] text-zinc-500">DESK</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex" aria-label="Secciones">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link
            href="/buscar"
            title="Buscar en toda la plataforma"
            aria-label="Buscar en toda la plataforma"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
              isActive(pathname, "/buscar") ? "bg-[#20A4DD]/10 text-[#45B8E8]" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Search size={18} />
          </Link>
          <Link
            href="/perfil"
            title="Mi perfil"
            className={`hidden items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/5 sm:flex ${
              isActive(pathname, "/perfil") ? "bg-[#20A4DD]/10" : ""
            }`}
          >
            <Avatar name={userName} url={avatarUrl} size={32} />
            <div className="hidden leading-tight xl:block">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-[11px] text-zinc-600">{roleLabel}</p>
            </div>
          </Link>
          <div className="hidden lg:block">
            <LogoutButton compact />
          </div>

          <details ref={mobileMenu} className="relative lg:hidden">
            <summary
              className="flex cursor-pointer list-none rounded-lg border border-white/10 p-2 text-zinc-400 [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </summary>
            <nav className="absolute right-0 top-12 z-40 flex w-60 flex-col gap-1 rounded-xl border border-white/10 bg-[#080A0C] p-3 shadow-2xl">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-white/10 pt-2">
                <Link href="/perfil" className={`${linkClass("/perfil")} flex items-center gap-2`}>
                  <Avatar name={userName} url={avatarUrl} size={22} /> Mi perfil
                </Link>
                <LogoutButton />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
