// Búsqueda simple para listados: sin tildes ni mayúsculas ("Botanía" encuentra "botania").
export function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Lee ?q= de la URL (máximo 100 caracteres).
export async function readSearchQuery(
  searchParams: Promise<{ q?: string | string[] }> | undefined,
) {
  const raw = (await searchParams)?.q;
  return (Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().slice(0, 100);
}

// Junta los textos de campos y relaciones (objetos o listas de Supabase),
// sin incluir ids, fechas ni códigos de estado.
function collectText(value: unknown, out: string[]) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectText(item, out));
  else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key === "id" || key.endsWith("_id") || key.endsWith("_at") || key === "status") continue;
      collectText(nested, out);
    }
  }
}

export function matchesSearch(query: string, fields: unknown[]) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  const texts: string[] = [];
  fields.forEach(field => collectText(field, texts));
  return texts.some(text => normalizeSearch(text).includes(normalizedQuery));
}
