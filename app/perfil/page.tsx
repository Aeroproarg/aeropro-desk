"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, KeyRound, Save, Trash2, UserRound } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Avatar from "../avatar";

// Mi perfil: cada persona edita su foto, nombre de usuario, especialidad y disponibilidad, y su contraseña.
// Nombre, mail y roles los gestiona Coordinación o Administración desde Usuarios.

const supabase = createClient();

const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE_PROYECTO: "Responsable de proyecto",
  COORDINACION: "Coordinación",
  PRODUCCION: "Producción",
  ADMINISTRACION: "Administración",
  EDITOR: "Edición",
  FREELANCE: "Freelance",
};

const AVATAR_SIZE = 320; // píxeles del lado: suficiente para verse nítida y pesar poco

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#050607] px-4 py-3 text-sm text-white outline-none transition focus:border-[#20A4DD] disabled:opacity-50";

type Me = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
};

// Recorta la imagen al centro en un cuadrado y la achica, para que suba rápido y pese poco.
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo procesar la imagen.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
    0, 0, AVATAR_SIZE, AVATAR_SIZE
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))), "image/jpeg", 0.85)
  );
}

// Ruta del archivo dentro del almacenamiento de fotos, a partir de su enlace público.
function storagePath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length).split("?")[0]) : null;
}

export default function MyProfilePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [availability, setAvailability] = useState("AVAILABLE");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,display_username,usual_specialty,availability,avatar_url,user_roles ( roles ( name ) )")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoadError("No se pudo cargar tu perfil. Si recién se actualizó la plataforma, puede faltar activar \"Mi perfil\" en la base de datos.");
        return;
      }
      const roles = ((data.user_roles ?? []) as { roles: { name: string } | { name: string }[] | null }[])
        .map((item) => (Array.isArray(item.roles) ? item.roles[0]?.name : item.roles?.name))
        .filter((name): name is string => Boolean(name));
      setMe({ id: data.id, email: user.email ?? "", fullName: data.full_name, roles });
      setAvatarUrl(data.avatar_url ?? null);
      setUsername(data.display_username ?? "");
      setSpecialty(data.usual_specialty ?? "");
      setAvailability(data.availability ?? "AVAILABLE");
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  async function saveProfile(nextAvatarUrl: string | null, successText: string) {
    const { error } = await supabase.rpc("update_my_profile", {
      p_display_username: username,
      p_usual_specialty: specialty,
      p_availability: availability,
      p_avatar_url: nextAvatarUrl,
    });
    if (error) throw error;
    setAvatarUrl(nextAvatarUrl);
    setMessage(successText);
    router.refresh(); // actualiza la foto de la barra de arriba
  }

  function errorText(err: unknown, fallback: string) {
    return typeof err === "object" && err !== null && "message" in err ? String(err.message) : fallback;
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await saveProfile(avatarUrl, "Perfil guardado.");
    } catch (err) {
      setError(errorText(err, "No se pudo guardar el perfil."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file || !me || saving) return;
    setSaving(true); setError(""); setMessage("");
    const previous = storagePath(avatarUrl);
    try {
      let image: Blob;
      try {
        image = await squareJpeg(file);
      } catch {
        throw new Error("No se pudo leer esa imagen. Probá con una foto JPG o PNG.");
      }
      const path = `${me.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, image, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw new Error("No se pudo subir la foto. Intentá de nuevo.");
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile(data.publicUrl, "Foto actualizada.");
      // La foto anterior ya no se usa: se borra de tu carpeta.
      if (previous && previous.startsWith(`${me.id}/`)) {
        await supabase.storage.from("avatars").remove([previous]);
      }
    } catch (err) {
      setError(errorText(err, "No se pudo actualizar la foto."));
    } finally {
      setSaving(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto() {
    if (!me || saving || !avatarUrl) return;
    setSaving(true); setError(""); setMessage("");
    const previous = storagePath(avatarUrl);
    try {
      await saveProfile(null, "Foto quitada.");
      if (previous && previous.startsWith(`${me.id}/`)) {
        await supabase.storage.from("avatars").remove([previous]);
      }
    } catch (err) {
      setError(errorText(err, "No se pudo quitar la foto."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passwordSaving) return;
    setPasswordError(""); setPasswordMessage("");
    if (password.length < 8) return setPasswordError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== passwordRepeat) return setPasswordError("Las dos contraseñas no coinciden.");
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw new Error(/reauth|recent|nonce/i.test(error.message)
          ? "Por seguridad, cerrá sesión, volvé a entrar y probá de nuevo."
          : /different|same/i.test(error.message)
          ? "La contraseña nueva tiene que ser distinta de la actual."
          : "No se pudo cambiar la contraseña.");
      }
      await supabase.rpc("log_my_password_change");
      setPassword(""); setPasswordRepeat("");
      setPasswordMessage("Contraseña cambiada. La próxima vez entrá con la nueva.");
    } catch (err) {
      setPasswordError(errorText(err, "No se pudo cambiar la contraseña."));
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">
        <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <p className="text-sm text-zinc-500">Cargando tu perfil...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
          <ArrowLeft size={16} /> Volver al inicio
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
            <UserRound size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
            <p className="mt-1 text-sm text-zinc-500">Tu foto y tus datos visibles para el equipo.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="space-y-7 p-6">
            <div className="flex flex-wrap items-center gap-5">
              <Avatar name={me.fullName} url={avatarUrl} size={88} />
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => fileInput.current?.click()}
                    className="flex h-9 items-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-3 text-sm text-[#45B8E8] transition hover:bg-[#20A4DD]/20 disabled:opacity-50">
                    <Camera size={15} /> {avatarUrl ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {avatarUrl && (
                    <button type="button" disabled={saving} onClick={removePhoto}
                      className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-400 transition hover:bg-white/5 disabled:opacity-50">
                      <Trash2 size={15} /> Quitar
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-600">Se recorta cuadrada y se achica automáticamente.</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-zinc-600">Nombre</p>
                <p className="mt-1 text-zinc-200">{me.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600">Mail de acceso</p>
                <p className="mt-1 break-all text-zinc-200">{me.email}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-zinc-600">Roles</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {me.roles.map((role) => (
                    <span key={role} className="rounded-full border border-[#20A4DD]/20 bg-[#20A4DD]/10 px-2 py-0.5 text-[11px] text-[#45B8E8]">
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-zinc-600 md:col-span-2">Nombre, mail y roles los cambia Coordinación o Administración.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="username">Nombre de usuario</label>
                <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ej. eze.escobar" className={inputClass} />
                <p className="mt-2 text-xs text-zinc-600">Opcional. Sin espacios.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="specialty">Especialidad</label>
                <input id="specialty" type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ej. Edición, Drone, Cámara" className={inputClass} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="availability">Disponibilidad</label>
                <select id="availability" value={availability} onChange={(e) => setAvailability(e.target.value)} className={inputClass}>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="UNAVAILABLE">No disponible</option>
                </select>
              </div>
            </div>

            {error && <p role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
          </div>

          <div className="flex justify-end border-t border-white/10 bg-[#080A0C] px-6 py-4">
            <button type="submit" disabled={saving}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={16} /> {saving ? "Guardando..." : "Guardar perfil"}
            </button>
          </div>
        </form>

        <form onSubmit={handlePassword} className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F12]">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-[#45B8E8]" /> Cambiar contraseña</h2>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña nueva (mínimo 8)" autoComplete="new-password" className={inputClass} />
            <input type="password" value={passwordRepeat} onChange={(e) => setPasswordRepeat(e.target.value)} placeholder="Repetir contraseña nueva" autoComplete="new-password" className={inputClass} />
            {passwordError && <p role="alert" className="text-sm text-red-300 md:col-span-2">{passwordError}</p>}
            {passwordMessage && <p role="status" className="text-sm text-emerald-300 md:col-span-2">{passwordMessage}</p>}
          </div>
          <div className="flex justify-end border-t border-white/10 bg-[#080A0C] px-6 py-4">
            <button type="submit" disabled={passwordSaving || !password}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
              {passwordSaving ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
