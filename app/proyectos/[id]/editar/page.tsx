"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  ExternalLink,
  FolderKanban,
  Save,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type Client = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  full_name: string;
};

type Category = {
  id: string;
  name: string;
};

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const id = params.id as string;

  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [briefDescription, setBriefDescription] = useState("");
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
        { data: projectData, error: projectError },
        { data: clientData, error: clientError },
        { data: profileData, error: profileError },
        { data: categoryData, error: categoryError },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select(`
            id,
            name,
            client_id,
            main_responsible_user_id,
            category_id,
            status,
            brief_description,
            drive_url,
            notes
          `)
          .eq("id", id)
          .single(),

        supabase
          .from("clients")
          .select("id, name")
          .eq("status", "ACTIVE")
          .order("name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("status", "ACTIVE")
          .order("full_name", { ascending: true }),

        supabase
          .from("project_categories")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (
        projectError ||
        !projectData ||
        clientError ||
        profileError ||
        categoryError
      ) {
        setErrorMessage(
          "No se pudieron cargar los datos del proyecto."
        );
        setLoading(false);
        return;
      }

      setName(projectData.name ?? "");
      setClientId(projectData.client_id ?? "");
      setResponsibleUserId(
        projectData.main_responsible_user_id ?? ""
      );
      setCategoryId(projectData.category_id ?? "");
      setStatus(projectData.status ?? "ACTIVE");
      setBriefDescription(
        projectData.brief_description ?? ""
      );
      setDriveUrl(projectData.drive_url ?? "");
      setNotes(projectData.notes ?? "");

      setClients(clientData ?? []);
      setProfiles(profileData ?? []);
      setCategories(categoryData ?? []);

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
      setErrorMessage("Ingresá el nombre del proyecto.");
      return;
    }

    if (!clientId) {
      setErrorMessage("Seleccioná un cliente.");
      return;
    }

    if (!responsibleUserId) {
      setErrorMessage("Seleccioná un responsable.");
      return;
    }

    if (!categoryId) {
      setErrorMessage("Seleccioná una categoría.");
      return;
    }

    setSaving(true);

    const updateData = {
      name: name.trim(),
      client_id: clientId,
      main_responsible_user_id: responsibleUserId,
      category_id: categoryId,
      status,
      brief_description:
        briefDescription.trim() || null,
      drive_url: driveUrl.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
      closed_at:
        status === "CLOSED"
          ? new Date().toISOString()
          : null,
    };

    const { error } = await supabase
      .from("projects")
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

    router.push(`/proyectos/${id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">
          Cargando proyecto...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <Link
          href={`/proyectos/${id}`}
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver al proyecto
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <FolderKanban size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Editar proyecto
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Actualizá la información general del proyecto.
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
                Nombre del proyecto
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
                  htmlFor="client"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Cliente
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="client"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="">
                    Seleccionar cliente
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Categoría
                  <span className="ml-1 text-[#20A4DD]">*</span>
                </label>

                <select
                  id="category"
                  required
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="">
                    Seleccionar categoría
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
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

                  <option value="PAUSED">
                    Pausado
                  </option>

                  <option value="CLOSED">
                    Cerrado
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="brief"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Descripción breve
              </label>

              <textarea
                id="brief"
                rows={4}
                value={briefDescription}
                onChange={(e) =>
                  setBriefDescription(e.target.value)
                }
                placeholder="Descripción general del proyecto..."
                className="w-full resize-none rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />
            </div>

            <div>
              <label
                htmlFor="drive"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Link de Drive
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
                Observaciones
              </label>

              <textarea
                id="notes"
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional del proyecto..."
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
                href={`/proyectos/${id}`}
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