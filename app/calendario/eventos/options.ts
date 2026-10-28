import { createClient } from "@/utils/supabase/server";

// Listas para el formulario de reuniones: personas activas, proyectos abiertos, trabajos y producciones.
export async function loadEventOptions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [people, projects, jobs, productions, canEdit] = await Promise.all([
    supabase.from("profiles").select("id,full_name").eq("status", "ACTIVE").order("full_name"),
    supabase.from("projects").select("id,name,status").order("name"),
    supabase.from("jobs").select("id,name,project_id,status").order("name"),
    supabase.from("productions").select("id,name,start_at,status").order("start_at", { ascending: false, nullsFirst: false }).limit(100),
    supabase.rpc("can_edit_calendar"),
  ]);
  return {
    canEdit: canEdit.data === true,
    people: (people.data ?? []).map((p) => ({ id: p.id, name: p.full_name })),
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.status === "CLOSED" ? `${p.name} (cerrado)` : p.name })),
    jobs: (jobs.data ?? []).map((j) => ({ id: j.id, name: j.name, parent: j.project_id })),
    productions: (productions.data ?? []).map((p) => ({ id: p.id, name: p.name })),
  };
}
