import { createSign } from "node:crypto";

// Conexión con Google Calendar mediante una cuenta de servicio de Google Cloud.
// Solo para el servidor. Variables (en Netlify, nunca en el código):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY (clave privada PEM), GOOGLE_CALENDAR_ID.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
export const CALENDAR_TIME_ZONE = "America/Argentina/Buenos_Aires";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function googleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_ID
  );
}

// Acepta la clave tal como se copie: el JSON entero, el valor de "private_key" con o sin comillas,
// y con los "\n" escritos como texto (así queda al pegarla en Netlify).
function privateKey() {
  let raw = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "").trim();
  if (raw.startsWith("{")) {
    try { raw = String(JSON.parse(raw).private_key ?? ""); } catch { /* se usa tal cual */ }
  }
  raw = raw.replace(/^"+|"+,?$/g, "");
  return raw.replace(/\\n/g, "\n");
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signature = base64url(createSign("RSA-SHA256").update(`${header}.${claims}`).sign(privateKey()));
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Google no aceptó la cuenta de servicio (${response.status}).`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function call(method: string, path: string, body?: unknown) {
  const token = await accessToken();
  return fetch(`${API}/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Código fijo del evento en Google, derivado del código en la plataforma: nunca se duplica.
export function googleEventId(kind: "production" | "event", id: string) {
  return `${kind === "production" ? "aprod" : "aevt"}${id.replace(/-/g, "").toLowerCase()}`;
}

export type CalendarEvent = {
  summary: string;
  description: string;
  location?: string | null;
  start: string; // ISO
  end: string; // ISO
  colorId?: string;
  kind: "production" | "event";
  platformId: string;
};

// Crea o actualiza el evento (también lo restaura si alguien lo había borrado en Google).
export async function upsertCalendarEvent(event: CalendarEvent) {
  const id = googleEventId(event.kind, event.platformId);
  const body = {
    summary: event.summary,
    description: event.description,
    location: event.location ?? "",
    start: { dateTime: event.start, timeZone: CALENDAR_TIME_ZONE },
    end: { dateTime: event.end, timeZone: CALENDAR_TIME_ZONE },
    colorId: event.colorId,
    status: "confirmed",
    extendedProperties: { private: { aeroproKind: event.kind, aeroproId: event.platformId } },
  };
  let response = await call("PATCH", `/events/${id}`, body);
  if (response.status === 404) response = await call("POST", "/events", { ...body, id });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Calendar respondió ${response.status}: ${detail.slice(0, 200)}`);
  }
  return id;
}

export async function deleteCalendarEvent(kind: "production" | "event", platformId: string) {
  const response = await call("DELETE", `/events/${googleEventId(kind, platformId)}`);
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Calendar respondió ${response.status} al borrar: ${detail.slice(0, 200)}`);
  }
}
