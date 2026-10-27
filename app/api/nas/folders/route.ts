import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  const token = process.env.NAS_INGEST_TOKEN;
  if (!token) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { data, error } = await admin().from("nas_folder_plans")
      .select("id,production_id,root_name,entries,revision")
      .eq("state", "PENDING").order("created_at").limit(20);
    if (error) throw error;
    return NextResponse.json({ plans: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar las carpetas pendientes." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)
      || !Number.isSafeInteger(body.revision) || body.revision < 1
      || !["READY", "ERROR"].includes(body.state)) {
      return NextResponse.json({ error: "Confirmación inválida." }, { status: 400 });
    }
    const { data, error } = await admin().from("nas_folder_plans").update({
      state: body.state,
      prepared_at: body.state === "READY" ? new Date().toISOString() : null,
      last_error: body.state === "ERROR" ? "El NAS no pudo preparar la carpeta. Revisá permisos o carpetas en conflicto y volvé a confirmar." : null,
    }).eq("id", body.id).eq("revision", body.revision).eq("state", "PENDING").select("id");
    if (error) throw error;
    return NextResponse.json({ ok: true, applied: (data?.length ?? 0) > 0 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la confirmación del NAS." }, { status: 503 });
  }
}
