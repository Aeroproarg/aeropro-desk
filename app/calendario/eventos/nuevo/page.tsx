import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { EventForm } from "../event-form";
import { loadEventOptions } from "../options";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const options = await loadEventOptions(supabase);
  if (!options.canEdit) redirect("/calendario");
  const defaultDate = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined;
  return <EventForm defaultDate={defaultDate} {...options} />;
}
