import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";

// Buscador de listados: envía ?q= a la misma página con Enter.
export function SearchBox({ action, query, placeholder, label }: {
  action: string; query: string; placeholder: string; label: string;
}) {
  return (
    <Form
      action={action}
      className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F12] px-3 text-sm text-zinc-500 focus-within:border-[#20A4DD]/50"
    >
      <Search size={17} />
      <input
        type="text"
        enterKeyHint="search"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        aria-label={label}
        className="w-56 bg-transparent text-white placeholder:text-zinc-500 focus:outline-none"
      />
      {query && (
        <Link href={action} aria-label="Limpiar búsqueda" className="text-zinc-500 transition hover:text-white">
          <X size={16} />
        </Link>
      )}
    </Form>
  );
}

// Línea "N resultados para “x”. Ver todos" arriba del listado.
export function SearchSummary({ query, count, singular, plural, clearHref }: {
  query: string; count: number; singular: string; plural: string; clearHref: string;
}) {
  if (!query) return null;
  return (
    <p className="mb-3 text-sm text-zinc-500">
      {count === 1 ? `1 ${singular}` : `${count} ${plural}`} para “{query}”.{" "}
      <Link href={clearHref} className="text-[#45B8E8] hover:underline">Ver todos</Link>
    </p>
  );
}

export function NoSearchResults({ query }: { query: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-zinc-300">No hay resultados para “{query}”</p>
      <p className="mt-2 text-xs text-zinc-600">Probá con otra palabra o revisá cómo está escrita.</p>
    </div>
  );
}
