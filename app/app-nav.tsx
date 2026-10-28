"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import LogoutButton from "./logout-button";

// Barra fija común a toda la plataforma: el logo y "Inicio" llevan siempre al Dashboard.

export type NavLink = { label: string; href: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav({
  links,
  userName,
  roleLabel,
  initials,
}: {
  links: NavLink[];
  userName: string;
  roleLabel: string;
  initials: string;
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
        <Link href="/" className="shrink-0" aria-label="Ir al inicio (Dashboard)">
          <span className="text-lg font-semibold tracking-tight">
            Aero<span className="text-[#20A4DD]">Pro</span>
          </span>
          <span className="ml-1.5 text-[9px] font-medium tracking-[0.28em] text-zinc-500">DESK</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex" aria-label="Secciones">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#20A4DD]/15 text-xs font-semibold text-[#45B8E8]">
              {initials}
            </div>
            <div className="hidden leading-tight xl:block">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-[11px] text-zinc-600">{roleLabel}</p>
            </div>
          </div>
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
                <LogoutButton />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
