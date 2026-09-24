"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string;
  full_name: string;
};

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const id = params.id as string;

  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [name, setName] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [driveUrl, setDriveUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [
        { data: clientData, error: clientError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(`
            id,
            name,
            main_responsible_user_id,
            status,
            drive_url,
            notes
          `)
          .eq("id", id)
          .single(),

        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("status", "ACTIVE")
          .order("full_name", { ascending: true }),
      ]);

      if (clientError || !clientData) {
        setErrorMessage("No se pudo cargar el cliente.");
        setLoading(false);
        return;
      }

      if (profileError) {
        setErrorMessage("No se pudieron cargar los responsables.");
        setLoading(false);
        return;
      }

      setName(clientData.name ?? "");
      setResponsibleUserId(
        clientData.main_responsible_user_id ?? ""
      );
      setStatus(clientData.status ?? "ACTIVE");
      setDriveUrl(clientData.drive_url ?? "");
      setNotes(clientData.notes ?? "");

      setProfiles(profileData ?? []);

      setLoading(false);
    }

    loadData();
  }, [id, router, supabase]);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Ingresá el nombre del cliente.");
      return;
    }

    if (!responsibleUserId) {
      setErrorMessage("Seleccioná un responsable principal.");
      return;
    }

    setSaving(true);

    const updateData: {
      name: string;
      main_responsible_user_id: string;
      status: string;
      drive_url: string | null;
      notes: string | null;
      updated_at: string;
      inactive_at: string | null;
    } = {
      name: name.trim(),
      main_responsible_user_id: responsibleUserId,
      status,
      drive_url: driveUrl.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
      inactive_at:
        status === "INACTIVE"
          ? new Date().toISOString()
          : null,
    };

    const { error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error(error);

      setErrorMessage(
        "No se pudieron guardar los cambios."
      );

      setSaving(false);
      return;
    }

    router.push(`/clientes/${id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando cliente...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">

        <Link
          href={`/clientes/${id}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver al cliente
        </Link>

        <div className="mb-8 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <Building2 size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar cliente
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Actualizá los datos generales y el responsable principal.
            </p>
          </div>

        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >

          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-sm font-semibold">
              Información general
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Los cambios se reflejarán inmediatamente en AeroPro Desk.
            </p>
          </div>

          <div className="space-y-6 p-6">

            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Nombre del cliente
                <span className="ml-1 text-[#20A4DD]">*</span>
              </label>

              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">

              <div>
                <label
                  htmlFor="responsible"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Responsable principal
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="responsible"
                  required
                  value={responsibleUserId}
                  onChange={(e) =>
                    setResponsibleUserId(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="">
                    Seleccionar responsable
                  </option>

                  {profiles.map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Estado
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="ACTIVE">
                    Activo
                  </option>

                  <option value="INACTIVE">
                    Inactivo
                  </option>
                </select>
              </div>

            </div>

            <div>
              <label
                htmlFor="drive"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Link principal de Drive
              </label>

              <div className="relative">

                <ExternalLink
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  id="drive"
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-lg border border-white/10 bg-[#050607] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
                />

              </div>
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Observaciones generales
              </label>

              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Información útil sobre el cliente..."
                className="w-full resize-none rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">

            <p className="text-xs text-zinc-700">
              * Campos obligatorios
            </p>

            <div className="flex gap-3">

              <Link
                href={`/clientes/${id}`}
                className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />

                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>

            </div>

          </div>

        </form>

      </div>
    </main>
  );
}