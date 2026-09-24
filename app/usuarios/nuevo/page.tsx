"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Save,
  UserPlus,
} from "lucide-react";

const AVAILABLE_ROLES = [
  {
    value: "RESPONSABLE_PROYECTO",
    label: "Responsable de proyecto",
  },
  {
    value: "COORDINACION",
    label: "Coordinación",
  },
  {
    value: "PRODUCCION",
    label: "Producción",
  },
  {
    value: "ADMINISTRACION",
    label: "Administración",
  },
  {
    value: "EDITOR",
    label: "Edición",
  },
  {
    value: "FREELANCE",
    label: "Freelance",
  },
];

export default function NewUserPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [usualSpecialty, setUsualSpecialty] = useState("");

  const [availability, setAvailability] =
    useState("AVAILABLE");

  const [roles, setRoles] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function toggleRole(role: string) {
    setRoles((currentRoles) =>
      currentRoles.includes(role)
        ? currentRoles.filter(
            (currentRole) => currentRole !== role
          )
        : [...currentRoles, role]
    );
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Ingresá el nombre del usuario.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Ingresá un email.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "La contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    if (roles.length === 0) {
      setErrorMessage(
        "Seleccioná al menos un rol."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          fullName,
          email,
          password,
          usualSpecialty,
          availability,
          roles,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "No se pudo crear el usuario."
        );

        setSaving(false);
        return;
      }

      router.push("/usuarios");
      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "No se pudo conectar con el servidor."
      );

      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">

        <Link
          href="/usuarios"
          className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver a Usuarios
        </Link>

        <div className="mb-8 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <UserPlus size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Nuevo usuario
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Creá una cuenta y asigná sus accesos
              dentro de AeroPro Desk
            </p>
          </div>

        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]"
        >

          <div className="border-b border-white/10 px-6 py-5">

            <h2 className="text-sm font-semibold">
              Información del usuario
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Datos de acceso, perfil y función dentro
              del equipo.
            </p>

          </div>

          <div className="space-y-7 p-6">

            <div>

              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Nombre completo
                <span className="ml-1 text-[#20A4DD]">
                  *
                </span>
              </label>

              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
                placeholder="Ej. Juan Pérez"
                className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
              />

            </div>

            <div className="grid gap-6 md:grid-cols-2">

              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Email
                  <span className="ml-1 text-[#20A4DD]">
                    *
                  </span>
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="nombre@aeropro.com.ar"
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
                />

              </div>

              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Contraseña inicial
                  <span className="ml-1 text-[#20A4DD]">
                    *
                  </span>
                </label>

                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
                />

              </div>

            </div>

            <div className="grid gap-6 md:grid-cols-2">

              <div>

                <label
                  htmlFor="specialty"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Especialidad habitual
                </label>

                <input
                  id="specialty"
                  type="text"
                  value={usualSpecialty}
                  onChange={(e) =>
                    setUsualSpecialty(e.target.value)
                  }
                  placeholder="Ej. Cámara / Drone / Edición"
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD]"
                />

              </div>

              <div>

                <label
                  htmlFor="availability"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Disponibilidad
                </label>

                <select
                  id="availability"
                  value={availability}
                  onChange={(e) =>
                    setAvailability(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD]"
                >
                  <option value="AVAILABLE">
                    Disponible
                  </option>

                  <option value="UNAVAILABLE">
                    No disponible para nuevas
                    asignaciones
                  </option>
                </select>

              </div>

            </div>

            <div>

              <div className="mb-3">

                <p className="text-sm font-medium text-zinc-300">
                  Roles
                  <span className="ml-1 text-[#20A4DD]">
                    *
                  </span>
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  Una persona puede tener varios roles.
                </p>

              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                {AVAILABLE_ROLES.map((role) => {
                  const checked = roles.includes(
                    role.value
                  );

                  return (
                    <label
                      key={role.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                        checked
                          ? "border-[#20A4DD]/50 bg-[#20A4DD]/10"
                          : "border-white/10 bg-[#050607] hover:border-white/20"
                      }`}
                    >

                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleRole(role.value)
                        }
                        className="h-4 w-4 accent-[#20A4DD]"
                      />

                      <span
                        className={
                          checked
                            ? "text-sm text-white"
                            : "text-sm text-zinc-400"
                        }
                      >
                        {role.label}
                      </span>

                    </label>
                  );
                })}

              </div>

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
                href="/usuarios"
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
                  ? "Creando..."
                  : "Crear usuario"}

              </button>

            </div>

          </div>

        </form>

      </div>
    </main>
  );
}