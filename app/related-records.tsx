import Link from "next/link";
import { Plus } from "lucide-react";
import { displayTimeZone } from "@/utils/dates";

// Bloque de "registros relacionados" para fichas de cliente y proyecto. Solo lectura.

export type RelatedRow = {
  key: string;
  href: string;
  title: string;
  subtitle?: string;
  status?: string;
  closed?: boolean;
  date?: string | null;
  dateLabel?: string;
};

function formatDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleString("es-AR", {
    timeZone: displayTimeZone(value),
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function RelatedSection({
  title,
  description,
  icon,
  rows,
  emptyText,
  action,
  limit = 8,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: RelatedRow[];
  emptyText: string;
  action?: { href: string; label: string };
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-[#45B8E8]">{icon}</div>
          <div>
            <h2 className="text-sm font-semibold">
              {title} <span className="ml-1 text-xs font-normal text-zinc-500">{rows.length}</span>
            </h2>
            <p className="mt-1 text-xs text-zinc-600">{description}</p>
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-xs font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/20"
          >
            <Plus size={14} />
            {action.label}
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-5 text-sm text-zinc-600">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className={`flex items-center gap-3 px-6 py-3 transition hover:bg-white/[0.02] ${row.closed ? "opacity-60" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">{row.title}</span>
                  {row.subtitle && <span className="block truncate text-xs text-zinc-500">{row.subtitle}</span>}
                </span>
                {row.date && (
                  <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">
                    {row.dateLabel ? `${row.dateLabel} ` : ""}
                    {formatDate(row.date)}
                  </span>
                )}
                {row.status && (
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-zinc-400">
                    {row.status}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && (
        <p className="border-t border-white/5 px-6 py-3 text-xs text-zinc-600">Y {rows.length - limit} más.</p>
      )}
    </section>
  );
}

// Supabase devuelve las relaciones como objeto o como lista según el caso.
export function relationField(relation: unknown, field: string): string | undefined {
  const value = Array.isArray(relation) ? relation[0] : relation;
  if (!value || typeof value !== "object") return undefined;
  const result = (value as Record<string, unknown>)[field];
  return result == null ? undefined : String(result);
}
