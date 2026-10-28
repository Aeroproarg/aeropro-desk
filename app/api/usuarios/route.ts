import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const ALLOWED_ROLES = [
  "RESPONSABLE_PROYECTO",
  "COORDINACION",
  "PRODUCCION",
  "ADMINISTRACION",
  "EDITOR",
  "FREELANCE",
];

export async function POST(request: Request) {
  try {
    // 1. Comprobamos quién está haciendo la petición
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    // 2. Cliente administrativo privado
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3. Comprobamos que quien crea usuarios tenga permiso
    const { data: requesterRoles, error: requesterRolesError } =
      await admin
        .from("user_roles")
        .select(`
          roles (
            name
          )
        `)
        .eq("user_id", user.id);

    if (requesterRolesError) {
      return NextResponse.json(
        { error: "No se pudieron verificar los permisos." },
        { status: 500 }
      );
    }

    const requesterRoleNames =
      requesterRoles
        ?.map((item: any) => item.roles?.name)
        .filter(Boolean) ?? [];

    const canCreateUsers =
      requesterRoleNames.includes("COORDINACION") ||
      requesterRoleNames.includes("ADMINISTRACION");

    if (!canCreateUsers) {
      return NextResponse.json(
        { error: "No tenés permiso para crear usuarios." },
        { status: 403 }
      );
    }

    // 4. Leemos los datos enviados por el formulario
    const body = await request.json();

    const {
      fullName,
      email,
      password,
      usualSpecialty,
      availability,
      roles,
    } = body;

    if (!fullName?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "El email es obligatorio." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener al menos 8 caracteres.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { error: "Seleccioná al menos un rol." },
        { status: 400 }
      );
    }

    const invalidRole = roles.some(
      (role: string) => !ALLOWED_ROLES.includes(role)
    );

    if (invalidRole) {
      return NextResponse.json(
        { error: "Se recibió un rol inválido." },
        { status: 400 }
      );
    }

    // 5. Creamos la cuenta en Supabase Auth
    const {
      data: createdUserData,
      error: createUserError,
    } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "No se pudo crear el usuario.",
        },
        { status: 400 }
      );
    }

    const newUserId = createdUserData.user.id;

    // 6. Perfil y roles con la sesión de quien crea el usuario: así Actividad lo registra a su nombre.
    //    La base valida permisos y roles. Si falla, se elimina la cuenta recién creada.
    const { error: profileError } = await supabase.rpc("admin_save_user_profile", {
      p_user_id: newUserId,
      p_full_name: fullName.trim(),
      p_usual_specialty: usualSpecialty?.trim() || null,
      p_availability: availability || "AVAILABLE",
      p_roles: roles,
      p_status: "ACTIVE",
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: profileError.message || "No se pudo crear el perfil del usuario." },
        { status: 500 }
      );
    }

    await supabase.rpc("log_user_account_change", {
      p_user_id: newUserId,
      p_description: `creó la cuenta de acceso (${email.trim().toLowerCase()})`,
    });

    return NextResponse.json({
      success: true,
      userId: newUserId,
    });
  } catch (error) {
    console.error("Error creating user:", error);

    return NextResponse.json(
      { error: "Ocurrió un error inesperado." },
      { status: 500 }
    );
  }
}