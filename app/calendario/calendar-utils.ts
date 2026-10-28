import { ARGENTINA_TIME_ZONE } from "@/utils/dates";

// Argentina no tiene horario de verano: siempre UTC-3.
export const AR_OFFSET = "-03:00";

export const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "MEETING", label: "Reunión interna" },
  { value: "CLIENT_MEETING", label: "Reunión con cliente" },
  { value: "VISIT", label: "Visita / scouting" },
  { value: "OTHER", label: "Otro" },
];

export const EVENT_STATUSES: { value: string; label: string }[] = [
  { value: "SCHEDULED", label: "Programado" },
  { value: "DONE", label: "Realizado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function eventTypeLabel(value: string) {
  return EVENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

// Día (AAAA-MM-DD) de una fecha, en hora de Argentina.
export function argentinaDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ARGENTINA_TIME_ZONE }).format(new Date(value));
}

export function argentinaTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ARGENTINA_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

// Para los campos "fecha y hora" del formulario: ISO → "AAAA-MM-DDTHH:MM" en hora de Argentina.
export function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// "AAAA-MM-DDTHH:MM" escrito en hora de Argentina → ISO.
export function fromLocalInput(value: string) {
  return new Date(`${value}:00${AR_OFFSET}`).toISOString();
}
