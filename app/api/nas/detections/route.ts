import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest
) {
  try {
    const authHeader =
      request.headers.get(
        "authorization"
      );

    const expectedToken =
      process.env.NAS_INGEST_TOKEN;

    if (!expectedToken) {
      return NextResponse.json(
        {
          error:
            "NAS_INGEST_TOKEN no configurado.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      authHeader !==
      `Bearer ${expectedToken}`
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecret =
      process.env
        .SUPABASE_SECRET_KEY;

    if (
      !supabaseUrl ||
      !supabaseSecret
    ) {
      return NextResponse.json(
        {
          error:
            "Configuración de Supabase incompleta.",
        },
        {
          status: 500,
        }
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseSecret,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const body =
      await request.json();

    const nasPath =
      typeof body.nasPath ===
      "string"
        ? body.nasPath.trim()
        : "";

    const backupDate =
      typeof body.backupDate ===
      "string" &&
      body.backupDate.trim()
        ? body.backupDate.trim()
        : null;

    const backupPersonName =
      typeof body.backupPersonName ===
      "string" &&
      body.backupPersonName.trim()
        ? body.backupPersonName.trim()
        : null;

    const detectedProjectName =
      typeof body.detectedProjectName ===
      "string" &&
      body.detectedProjectName.trim()
        ? body.detectedProjectName.trim()
        : null;

    const materialName =
      typeof body.materialName ===
      "string" &&
      body.materialName.trim()
        ? body.materialName.trim()
        : null;

    const fileCount =
      typeof body.fileCount ===
      "number"
        ? body.fileCount
        : null;

    const totalSizeBytes =
      typeof body.totalSizeBytes ===
      "number"
        ? body.totalSizeBytes
        : null;

    if (!nasPath) {
      return NextResponse.json(
        {
          error:
            "nasPath es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date().toISOString();

    /*
     * Primero vemos si esta ruta
     * ya había sido detectada.
     */

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        "nas_material_detections"
      )
      .select(`
        id,
        nas_path,
        link_status,
        storage_status,
        production_id,
        project_id
      `)
      .eq(
        "nas_path",
        nasPath
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "NAS lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Si ya existe:
     * actualizamos datos técnicos,
     * pero NO tocamos la vinculación.
     */

    if (existing) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "nas_material_detections"
        )
        .update({
          backup_date:
            backupDate,
          backup_person_name:
            backupPersonName,
          detected_project_name:
            detectedProjectName,
          material_name:
            materialName,
          file_count:
            fileCount,
          total_size_bytes:
            totalSizeBytes,
          last_seen_at:
            now,
          updated_at:
            now,
        })
        .eq(
          "id",
          existing.id
        )
        .select(`
          id,
          nas_path,
          link_status,
          storage_status,
          production_id,
          project_id
        `)
        .single();

      if (error) {
        console.error(
          "NAS update error:",
          error
        );

        return NextResponse.json(
          {
            error:
              error.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          created: false,
          detection: data,
        },
        {
          status: 200,
        }
      );
    }

    /*
     * Si nunca vimos esta ruta:
     * crear una detección nueva.
     */

    const {
      data,
      error,
    } = await supabase
      .from(
        "nas_material_detections"
      )
      .insert({
        nas_path:
          nasPath,
        backup_date:
          backupDate,
        backup_person_name:
          backupPersonName,
        detected_project_name:
          detectedProjectName,
        material_name:
          materialName,
        file_count:
          fileCount,
        total_size_bytes:
          totalSizeBytes,
        link_status:
          "UNLINKED",
        storage_status:
          "BACKUP",
        detected_at:
          now,
        last_seen_at:
          now,
        updated_at:
          now,
      })
      .select(`
        id,
        nas_path,
        link_status,
        storage_status
      `)
      .single();

    if (error) {
      console.error(
        "NAS insert error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        created: true,
        detection: data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "NAS endpoint error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo procesar la detección.",
      },
      {
        status: 500,
      }
    );
  }
}