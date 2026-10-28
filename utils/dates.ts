// Las pantallas del servidor corren en Netlify con hora UTC.
// Para mostrar siempre la hora de Argentina, cada formato de fecha indica su zona.
export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

// Una fecha sin hora ("2026-10-10") se interpreta como medianoche UTC:
// se muestra en UTC para que no se corra al día anterior.
export function displayTimeZone(value: string | null | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? "UTC"
    : ARGENTINA_TIME_ZONE;
}
