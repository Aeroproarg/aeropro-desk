import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { EventForm, type EventData } from "../event-form";
import { loadEventOptions } from "../options";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: event }, options] = await Promise.all([
    supabase
      .from("events")
      .select("id,title,event_type,status,start_at,end_at,location,description,project_id,job_id,production_id,participants:event_participants ( id,user_id,external_name,external_email,external_company )")
      .eq("id", id)
      .maybeSingle(),
    loadEventOptions(supabase),
  ]);
  if (!event) notFound();
  return <EventForm event={event as EventData} {...options} />;
}
