import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Ver y editar un usuario. Solo Coordinación o Administración (lo valida la base con can_manage_users).
// Perfil y roles se guardan con la sesión de quien edita, para que Actividad lo registre a su nombre.
// La cuenta nunca se borra: la baja bloquea el acceso y conserva el historial.

const BAN_FOREVER = "876000h"; // ~100 años

type Context = { params: Promise<{ id: string }> };

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }
  const { data: allowed, error } = await supabase.rpc("can_manage_users");
  if (error) {
    return {
      response: NextResponse.json(
        { error: "La gestión de usuarios todavía no está activada en la base de datos." },
        { status: 500 }
      ),
    };
  }
  if (!allowed) {
    return {
      response: NextResponse.json({ error: "Solo Coordinación o Administración pueden gestionar usuarios." }, { status: 403 }),
    };
  }
  return { supabase, user };
}

function isBanned(bannedUntil: string | null | undefined) {
  return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const ctx = await requireManager();
  if ("response" in ctx) return ctx.response;

  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    ctx.supabase
      .from("profiles")
      .select("id,full_name,status,usual_specialty,availability,user_roles ( roles ( name ) )")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (authError || !authData?.user || profileError || !profile) {
    return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
  }

  const roles = ((profile.user_roles ?? []) as { roles: { name: string } | { name: string }[] | null }[])
    .map((item) => (Array.isArray(item.roles) ? item.roles[0]?.name : item.roles?.name))
    .filter(Boolean);

  return NextResponse.json({
    id: profile.id,
    fullName: profile.full_name,
    email: authData.user.email ?? "",
    status: profile.status,
    usualSpecialty: profile.usual_specialty ?? "",
    availability: profile.availability,
    roles,
    accessBlocked: isBanned((authData.user as { banned_until?: string }).banned_until),
    lastSignInAt: authData.user.last_sign_in_at ?? null,
    isSelf: profile.id === ctx.user.id,
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const ctx = await requireManager();
  if ("response" in ctx) return ctx.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { fullName, email, password, usualSpecialty, availability, roles, status } = body as {
    fullName?: string; email?: string; password?: string; usualSpecialty?: string;
    availability?: string; roles?: string[]; status?: string;
  };

  const newEmail = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Ingresá un mail válido." }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: "La contraseña nueva debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin.auth.admin.getUserById(id);
  if (currentError || !current?.user) {
    return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
  }

  // 1. Perfil y roles. La base valida permisos, roles y que nadie se dé de baja a sí mismo.
  const { error: saveError } = await ctx.supabase.rpc("admin_save_user_profile", {
    p_user_id: id,
    p_full_name: fullName ?? "",
    p_usual_specialty: usualSpecialty ?? null,
    p_availability: availability ?? "AVAILABLE",
    p_roles: Array.isArray(roles) ? roles : [],
    p_status: status ?? "ACTIVE",
  });
  if (saveError) {
    return NextResponse.json({ error: saveError.message || "No se pudo guardar el usuario." }, { status: 400 });
  }

  // 2. Cuenta de acceso: mail, contraseña y bloqueo.
  const authUpdate: { email?: string; email_confirm?: boolean; password?: string; ban_duration?: string } = {};
  const changes: string[] = [];
  if (newEmail !== (current.user.email ?? "").toLowerCase()) {
    authUpdate.email = newEmail;
    authUpdate.email_confirm = true;
    changes.push(`cambió el mail de acceso a ${newEmail}`);
  }
  if (password) {
    authUpdate.password = password;
    changes.push("asignó una contraseña nueva");
  }
  const blocked = isBanned((current.user as { banned_until?: string }).banned_until);
  if (status === "INACTIVE" && !blocked) {
    authUpdate.ban_duration = BAN_FOREVER;
    changes.push("dio de baja y bloqueó el acceso");
  }
  if (status === "ACTIVE" && blocked) {
    authUpdate.ban_duration = "none";
    changes.push("reactivó el acceso");
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (authError) {
      const message = /already|registered|exists/i.test(authError.message)
        ? "Ese mail ya lo usa otra cuenta."
        : `Se guardaron nombre y roles, pero no se pudo actualizar el acceso: ${authError.message}`;
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // 3. Actividad: los cambios de la cuenta de acceso, a nombre de quien los hizo (nunca la contraseña).
  for (const description of changes) {
    await ctx.supabase.rpc("log_user_account_change", { p_user_id: id, p_description: description });
  }

  return NextResponse.json({ success: true });
}
