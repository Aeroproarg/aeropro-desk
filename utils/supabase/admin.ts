import { createClient } from "@supabase/supabase-js";

// Cliente con la clave privada del servidor. Solo para rutas de API del servidor:
// nunca importarlo desde componentes del navegador ni exponer la clave.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
