"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, UserCog } from "lucide-react";

// Editar un usuario: nombre, mail, roles, especialidad, contraseña nueva y baja/reactivación.
// Solo Coordinación o Administración. La baja bloquea el acceso; la cuenta y su historial se conservan.

const AVAILABLE_ROLES = [
  { value: "RESPONSABLE_PROYECTO", label: "Responsable de proyecto" },
  { value: "COORDINACION", label: "Coordinación" },
  { value: "PRODUCCION", label: "Producción" },
  { value: "ADMINISTRACION", label: "Administración" },
  { value: "EDITOR", label: "Edición" },
  { value: "FREELANCE", label: "Freelance" },
];

type UserData = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  usualSpecialty: string;
  availability: string;
  roles: string[];
  accessBlocked: boolean;
  lastSignInAt: string | null;
  isSelf: boolean;
};

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
});

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD] disabled:opacity-50";

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [usualSpecialty, setUsualSpecialty] = useState("");
  const [availability, setAvailability] = useState("AVAILABLE");
  const [roles, setRoles] = useState<string[]>([]);
  const [status, setStatus] = useState("ACTIVE");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/usuarios/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(result.error || "No se pudo cargar el usuario.");
          return;
        }
        const data = result as UserData;
        setUser(data);
        setFullName(data.fullName);
        setEmail(data.email);
        setUsualSpecialty(data.usualSpecialty);
        setAvailability(data.availability || "AVAILABLE");
        setRoles(data.roles);
        setStatus(data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
      } catch {
        if (!cancelled) setLoadError("No se pudo conectar con el servidor.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  function toggleRole(role: string) {
    setRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !user) return;
    setErrorMessage("");

    if (!fullName.trim()) return setErrorMessage("Ingresá el nombre.");
    if (!email.trim()) return setErrorMessage("Ingresá el mail.");
    if (password && password.length < 8) return setErrorMessage("La contraseña nueva debe tener al menos 8 caracteres.");
    if (roles.length === 0) return setErrorMessage("Seleccioná al menos un rol.");
    if (status === "INACTIVE" && user.status !== "INACTIVE"
      && !window.confirm(`¿Dar de baja a ${fullName}? No va a poder entrar a la plataforma. Su historial se conserva y se puede reactivar.`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password: password || undefined, usualSpecialty, availability, roles, status }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrorMessage(result.error || "No se pudo guardar.");
        setSaving(false);
        return;
      }
      router.push("/usuarios");
      router.refresh();
    } catch {
      setErrorMessage("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
          <Link href="/usuarios" className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
            <ArrowLeft size={16} /> Volver a Usuarios
          </Link>
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">Cargando usuario...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <Link href="/usuarios" className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
          <ArrowLeft size={16} /> Volver a Usuarios
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <UserCog size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Editar usuario</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {user.lastSignInAt ? `Último ingreso: ${dateFormat.format(new Date(user.lastSignInAt))}` : "Todavía no ingresó a la plataforma"}
              {user.isSelf && " · Sos vos"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="space-y-7 p-6">
            <Field label="Nombre y apellido" required>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </Field>

            <Field label="Mail de acceso" required hint="Es el mail con el que la persona inicia sesión.">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Especialidad habitual">
                <input type="text" value={usualSpecialty} onChange={(e) => setUsualSpecialty(e.target.value)} placeholder="Ej. Edición, Drone, Cámara" className={inputClass} />
              </Field>
              <Field label="Disponibilidad">
                <select value={availability} onChange={(e) => setAvailability(e.target.value)} className={inputClass}>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="UNAVAILABLE">No disponible</option>
                </select>
              </Field>
            </div>

            <Field label="Roles" required hint="Coordinación y Administración ven todo, gestionan usuarios y ven la Actividad.">
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_ROLES.map((role) => (
                  <label key={role.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/[0.02]">
                    <input type="checkbox" checked={roles.includes(role.value)} onChange={() => toggleRole(role.value)} />
                    {role.label}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Contraseña nueva" hint="Dejala vacía para no cambiarla. Mínimo 8 caracteres. Pasásela a la persona por un medio privado.">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
            </Field>

            <section className={`rounded-xl border p-5 ${status === "INACTIVE" ? "border-red-900/50 bg-red-950/20" : "border-white/10"}`}>
              <p className="text-sm font-medium text-zinc-200">Acceso a la plataforma</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Dar de baja bloquea el ingreso. No se borra nada: lo que hizo sigue en la Actividad y en sus trabajos, y se puede reactivar.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input type="radio" name="status" checked={status === "ACTIVE"} onChange={() => setStatus("ACTIVE")} /> Activo
                </label>
                <label className={`flex items-center gap-2 text-sm ${user.isSelf ? "text-zinc-600" : "cursor-pointer text-zinc-300"}`}>
                  <input type="radio" name="status" disabled={user.isSelf} checked={status === "INACTIVE"} onChange={() => setStatus("INACTIVE")} /> Dado de baja
                </label>
              </div>
              {user.isSelf && <p className="mt-2 text-xs text-zinc-600">No podés darte de baja a vos mismo.</p>}
            </section>

            {errorMessage && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{errorMessage}</div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#080A0C] px-6 py-4">
            <p className="text-xs text-zinc-700">* Campos obligatorios</p>
            <div className="flex gap-3">
              <Link href="/usuarios" className="flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
                Cancelar
              </Link>
              <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-[#20A4DD]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}
