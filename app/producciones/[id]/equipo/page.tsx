"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CircleUserRound,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string;
};

type ProductionRole = {
  id: string;
  name: string;
};

const attendanceStatuses = [
  {
    value: "PENDING",
    label: "Pendiente",
  },
  {
    value: "CONFIRMED",
    label: "Confirmado",
  },
  {
    value: "PRESENT",
    label: "Presente",
  },
  {
    value: "ABSENT",
    label: "Ausente",
  },
  {
    value: "CANCELLED",
    label: "Cancelado",
  },
];

export default function ProductionTeamPage() {
  const params = useParams();
  const router = useRouter();

  const productionId =
    params.id as string;

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingInternal,
    setSavingInternal,
  ] = useState(false);

  const [
    savingExternal,
    setSavingExternal,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    productionName,
    setProductionName,
  ] = useState("");

  const [
    profiles,
    setProfiles,
  ] = useState<Profile[]>([]);

  const [
    roles,
    setRoles,
  ] = useState<ProductionRole[]>([]);

  const [
    internalParticipants,
    setInternalParticipants,
  ] = useState<any[]>([]);

  const [
    externalParticipants,
    setExternalParticipants,
  ] = useState<any[]>([]);

  /*
   * =====================================
   * FORM INTERNO
   * =====================================
   */

  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState("");

  const [
    selectedInternalRoleId,
    setSelectedInternalRoleId,
  ] = useState("");

  const [
    internalRoleDetail,
    setInternalRoleDetail,
  ] = useState("");

  const [
    internalAttendanceStatus,
    setInternalAttendanceStatus,
  ] = useState("CONFIRMED");

  /*
   * =====================================
   * FORM EXTERNO
   * =====================================
   */

  const [
    externalName,
    setExternalName,
  ] = useState("");

  const [
    externalEmail,
    setExternalEmail,
  ] = useState("");

  const [
    externalCompany,
    setExternalCompany,
  ] = useState("");

  const [
    selectedExternalRoleId,
    setSelectedExternalRoleId,
  ] = useState("");

  const [
    externalRoleDetail,
    setExternalRoleDetail,
  ] = useState("");

  const [
    externalAttendanceStatus,
    setExternalAttendanceStatus,
  ] = useState("CONFIRMED");

  /*
   * =====================================
   * DETECTAR "OTRO"
   * =====================================
   */

  const selectedInternalRole =
    useMemo(() => {
      return (
        roles.find(
          (role) =>
            role.id ===
            selectedInternalRoleId
        ) ?? null
      );
    }, [
      roles,
      selectedInternalRoleId,
    ]);

  const selectedExternalRole =
    useMemo(() => {
      return (
        roles.find(
          (role) =>
            role.id ===
            selectedExternalRoleId
        ) ?? null
      );
    }, [
      roles,
      selectedExternalRoleId,
    ]);

  const internalIsOther =
    normalizeRoleName(
      selectedInternalRole?.name
    ) === "otro";

  const externalIsOther =
    normalizeRoleName(
      selectedExternalRole?.name
    ) === "otro";

  /*
   * =====================================
   * CARGAR DATOS
   * =====================================
   */

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [
      productionResult,
      profilesResult,
      rolesResult,
      internalResult,
      externalResult,
    ] = await Promise.all([
      supabase
        .from("productions")
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          productionId
        )
        .single(),

      supabase
        .from("profiles")
        .select(`
          id,
          full_name
        `)
        .eq(
          "status",
          "ACTIVE"
        )
        .order(
          "full_name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("production_roles")
        .select(`
          id,
          name
        `)
        .order(
          "name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("production_participants")
        .select(`
          id,
          production_id,
          user_id,
          role_id,
          role_detail,
          attendance_status,
          attendance_reason,

          profile:user_id (
            id,
            full_name
          ),

          role:role_id (
            id,
            name
          )
        `)
        .eq(
          "production_id",
          productionId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "production_external_participants"
        )
        .select(`
          id,
          production_id,
          external_participant_id,
          role_id,
          role_detail,
          attendance_status,
          attendance_reason,

          external:external_participant_id (
            id,
            full_name,
            email,
            company
          ),

          role:role_id (
            id,
            name
          )
        `)
        .eq(
          "production_id",
          productionId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        ),
    ]);

    if (
      productionResult.error ||
      !productionResult.data
    ) {
      setErrorMessage(
        "No se pudo cargar la producción."
      );

      setLoading(false);

      return;
    }

    if (profilesResult.error) {
      console.error(
        profilesResult.error
      );

      setErrorMessage(
        "No se pudo cargar el equipo de AeroPro."
      );
    }

    if (rolesResult.error) {
      console.error(
        rolesResult.error
      );

      setErrorMessage(
        "No se pudieron cargar los roles."
      );
    }

    if (internalResult.error) {
      console.error(
        internalResult.error
      );

      setErrorMessage(
        "No se pudieron cargar los participantes internos."
      );
    }

    if (externalResult.error) {
      console.error(
        externalResult.error
      );

      setErrorMessage(
        "No se pudieron cargar los participantes externos."
      );
    }

    setProductionName(
      productionResult.data.name
    );

    setProfiles(
      (profilesResult.data ??
        []) as Profile[]
    );

    setRoles(
      (rolesResult.data ??
        []) as ProductionRole[]
    );

    setInternalParticipants(
      internalResult.data ??
        []
    );

    setExternalParticipants(
      externalResult.data ??
        []
    );

    setLoading(false);
  }

  useEffect(() => {
    if (productionId) {
      loadData();
    }
  }, [productionId]);

  /*
   * =====================================
   * AGREGAR INTERNO
   * =====================================
   */

  async function addInternalParticipant() {
    if (savingInternal) {
      return;
    }

    setErrorMessage("");

    if (!selectedUserId) {
      setErrorMessage(
        "Elegí una persona de AeroPro."
      );

      return;
    }

    if (!selectedInternalRoleId) {
      setErrorMessage(
        "Elegí el rol que tendrá en esta producción."
      );

      return;
    }

    if (
      internalIsOther &&
      !internalRoleDetail.trim()
    ) {
      setErrorMessage(
        "Si elegís 'Otro', tenés que especificar el rol."
      );

      return;
    }

    const alreadyExists =
      internalParticipants.some(
        (participant) =>
          participant.user_id ===
          selectedUserId
      );

    if (alreadyExists) {
      setErrorMessage(
        "Esta persona ya forma parte de la producción."
      );

      return;
    }

    setSavingInternal(true);

    const {
      error,
    } = await supabase
      .from("production_participants")
      .insert({
        production_id:
          productionId,

        user_id:
          selectedUserId,

        role_id:
          selectedInternalRoleId,

        role_detail:
          internalIsOther
            ? internalRoleDetail.trim()
            : null,

        attendance_status:
          internalAttendanceStatus,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message
      );

      setSavingInternal(false);

      return;
    }

    setSelectedUserId("");
    setSelectedInternalRoleId("");
    setInternalRoleDetail("");
    setInternalAttendanceStatus(
      "CONFIRMED"
    );

    await loadData();

    setSavingInternal(false);

    router.refresh();
  }

  /*
   * =====================================
   * AGREGAR EXTERNO
   * =====================================
   */

  async function addExternalParticipant() {
    if (savingExternal) {
      return;
    }

    setErrorMessage("");

    if (!externalName.trim()) {
      setErrorMessage(
        "Escribí el nombre del participante externo."
      );

      return;
    }

    if (!selectedExternalRoleId) {
      setErrorMessage(
        "Elegí el rol del participante externo."
      );

      return;
    }

    if (
      externalIsOther &&
      !externalRoleDetail.trim()
    ) {
      setErrorMessage(
        "Si elegís 'Otro', tenés que especificar el rol."
      );

      return;
    }

    setSavingExternal(true);

    const {
      data: externalPerson,
      error:
        externalPersonError,
    } = await supabase
      .from("external_participants")
      .insert({
        full_name:
          externalName.trim(),

        email:
          externalEmail.trim() ||
          null,

        company:
          externalCompany.trim() ||
          null,
      })
      .select(`
        id
      `)
      .single();

    if (
      externalPersonError ||
      !externalPerson
    ) {
      setErrorMessage(
        externalPersonError?.message ??
          "No se pudo crear el participante externo."
      );

      setSavingExternal(false);

      return;
    }

    const {
      error:
        linkError,
    } = await supabase
      .from(
        "production_external_participants"
      )
      .insert({
        production_id:
          productionId,

        external_participant_id:
          externalPerson.id,

        role_id:
          selectedExternalRoleId,

        role_detail:
          externalIsOther
            ? externalRoleDetail.trim()
            : null,

        attendance_status:
          externalAttendanceStatus,
      });

    if (linkError) {
      setErrorMessage(
        linkError.message
      );

      setSavingExternal(false);

      return;
    }

    setExternalName("");
    setExternalEmail("");
    setExternalCompany("");
    setSelectedExternalRoleId("");
    setExternalRoleDetail("");
    setExternalAttendanceStatus(
      "CONFIRMED"
    );

    await loadData();

    setSavingExternal(false);

    router.refresh();
  }

  /*
   * =====================================
   * CAMBIAR ASISTENCIA
   * =====================================
   */

  async function updateInternalAttendance(
    participantId: string,
    status: string
  ) {
    setErrorMessage("");

    const {
      error,
    } = await supabase
      .from("production_participants")
      .update({
        attendance_status:
          status,
      })
      .eq(
        "id",
        participantId
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setInternalParticipants(
      (current) =>
        current.map(
          (participant) =>
            participant.id ===
            participantId
              ? {
                  ...participant,
                  attendance_status:
                    status,
                }
              : participant
        )
    );

    router.refresh();
  }

  async function updateExternalAttendance(
    participantId: string,
    status: string
  ) {
    setErrorMessage("");

    const {
      error,
    } = await supabase
      .from(
        "production_external_participants"
      )
      .update({
        attendance_status:
          status,
      })
      .eq(
        "id",
        participantId
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setExternalParticipants(
      (current) =>
        current.map(
          (participant) =>
            participant.id ===
            participantId
              ? {
                  ...participant,
                  attendance_status:
                    status,
                }
              : participant
        )
    );

    router.refresh();
  }

  /*
   * =====================================
   * ELIMINAR
   * =====================================
   */

  async function removeInternalParticipant(
    participantId: string
  ) {
    const confirmed =
      window.confirm(
        "¿Quitar esta persona de la producción?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("production_participants")
      .delete()
      .eq(
        "id",
        participantId
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setInternalParticipants(
      (current) =>
        current.filter(
          (participant) =>
            participant.id !==
            participantId
        )
    );

    router.refresh();
  }

  async function removeExternalParticipant(
    participantId: string
  ) {
    const confirmed =
      window.confirm(
        "¿Quitar este participante externo de la producción?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from(
        "production_external_participants"
      )
      .delete()
      .eq(
        "id",
        participantId
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setExternalParticipants(
      (current) =>
        current.filter(
          (participant) =>
            participant.id !==
            participantId
        )
    );

    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] text-white">

        <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">

          <div className="rounded-xl border border-white/10 bg-[#0B0F12] px-6 py-10 text-center text-sm text-zinc-600">
            Cargando equipo...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">

      <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">

        <div className="mb-8">

          <Link
            href={`/producciones/${productionId}`}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />

            Volver a la producción
          </Link>

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/10 text-[#45B8E8]">
              <Users
                size={21}
              />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Equipo humano
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {productionName}
              </p>
            </div>

          </div>

        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900/30 bg-red-950/20 px-5 py-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* =====================================
            EQUIPO AEROPRO
        ===================================== */}

        <section className="rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Equipo AeroPro"
            subtitle="Personal interno asignado a la producción."
            icon={
              <Users
                size={17}
              />
            }
            count={
              internalParticipants.length
            }
          />

          <div className="border-b border-white/10 p-5">

            <div className="grid gap-4 md:grid-cols-[1.25fr_1fr_0.8fr_auto]">

              <Field
                label="Persona"
              >
                <select
                  value={
                    selectedUserId
                  }
                  onChange={(e) =>
                    setSelectedUserId(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Seleccionar persona
                  </option>

                  {profiles.map(
                    (profile) => (
                      <option
                        key={
                          profile.id
                        }
                        value={
                          profile.id
                        }
                      >
                        {
                          profile.full_name
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field
                label="Rol"
              >
                <select
                  value={
                    selectedInternalRoleId
                  }
                  onChange={(e) => {
                    setSelectedInternalRoleId(
                      e.target.value
                    );

                    setInternalRoleDetail("");
                  }}
                  className={inputClass}
                >
                  <option value="">
                    Seleccionar rol
                  </option>

                  {roles.map(
                    (role) => (
                      <option
                        key={
                          role.id
                        }
                        value={
                          role.id
                        }
                      >
                        {role.name}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field
                label="Estado"
              >
                <select
                  value={
                    internalAttendanceStatus
                  }
                  onChange={(e) =>
                    setInternalAttendanceStatus(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  {attendanceStatuses.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <div className="flex items-end">

                <button
                  type="button"
                  onClick={
                    addInternalParticipant
                  }
                  disabled={
                    savingInternal
                  }
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#20A4DD] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50 md:w-auto"
                >
                  <UserPlus
                    size={15}
                  />

                  {savingInternal
                    ? "Agregando..."
                    : "Agregar"}
                </button>

              </div>

            </div>

            {internalIsOther && (
              <div className="mt-4 rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/[0.04] p-4">

                <Field
                  label="Especificar rol *"
                >
                  <input
                    type="text"
                    value={
                      internalRoleDetail
                    }
                    onChange={(e) =>
                      setInternalRoleDetail(
                        e.target.value
                      )
                    }
                    placeholder="Ej: Chofer, vestuario, maquillaje..."
                    autoFocus
                    className={inputClass}
                  />
                </Field>

                <p className="mt-2 text-[11px] text-zinc-600">
                  Este campo es obligatorio cuando elegís “Otro”.
                </p>

              </div>
            )}

          </div>

          {internalParticipants.length ===
          0 ? (
            <EmptyState
              text="Todavía no hay integrantes de AeroPro asignados."
            />
          ) : (
            <div className="divide-y divide-white/5">

              {internalParticipants.map(
                (participant) => {

                  const profile =
                    firstRelation(
                      participant.profile
                    );

                  const role =
                    firstRelation(
                      participant.role
                    );

                  const roleLabel =
                    getRoleLabel(
                      role?.name,
                      participant.role_detail
                    );

                  return (
                    <div
                      key={
                        participant.id
                      }
                      className="grid gap-4 px-5 py-4 md:grid-cols-[1.25fr_1fr_0.9fr_auto] md:items-center"
                    >

                      <div className="flex items-center gap-3">

                        <CircleUserRound
                          size={18}
                          className="shrink-0 text-zinc-600"
                        />

                        <p className="text-sm font-medium text-zinc-300">
                          {profile?.full_name ??
                            "Usuario"}
                        </p>

                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                          Rol
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          {roleLabel}
                        </p>
                      </div>

                      <select
                        value={
                          participant.attendance_status ??
                          "CONFIRMED"
                        }
                        onChange={(e) =>
                          updateInternalAttendance(
                            participant.id,
                            e.target.value
                          )
                        }
                        className={smallSelectClass}
                      >
                        {attendanceStatuses.map(
                          (item) => (
                            <option
                              key={
                                item.value
                              }
                              value={
                                item.value
                              }
                            >
                              {item.label}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          removeInternalParticipant(
                            participant.id
                          )
                        }
                        title="Quitar de la producción"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-red-900/40 hover:bg-red-950/20 hover:text-red-400"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* =====================================
            EXTERNOS
        ===================================== */}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0B0F12]">

          <SectionHeader
            title="Participantes externos"
            subtitle="Clientes, proveedores, colaboradores o personal externo."
            icon={
              <BriefcaseBusiness
                size={17}
              />
            }
            count={
              externalParticipants.length
            }
          />

          <div className="border-b border-white/10 p-5">

            <div className="grid gap-4 md:grid-cols-2">

              <Field
                label="Nombre"
              >
                <input
                  type="text"
                  value={
                    externalName
                  }
                  onChange={(e) =>
                    setExternalName(
                      e.target.value
                    )
                  }
                  placeholder="Nombre y apellido"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Empresa / organización"
              >
                <input
                  type="text"
                  value={
                    externalCompany
                  }
                  onChange={(e) =>
                    setExternalCompany(
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Email"
              >
                <input
                  type="email"
                  value={
                    externalEmail
                  }
                  onChange={(e) =>
                    setExternalEmail(
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Rol"
              >
                <select
                  value={
                    selectedExternalRoleId
                  }
                  onChange={(e) => {
                    setSelectedExternalRoleId(
                      e.target.value
                    );

                    setExternalRoleDetail("");
                  }}
                  className={inputClass}
                >
                  <option value="">
                    Seleccionar rol
                  </option>

                  {roles.map(
                    (role) => (
                      <option
                        key={
                          role.id
                        }
                        value={
                          role.id
                        }
                      >
                        {role.name}
                      </option>
                    )
                  )}
                </select>
              </Field>

              {externalIsOther && (
                <div className="md:col-span-2 rounded-xl border border-[#20A4DD]/20 bg-[#20A4DD]/[0.04] p-4">

                  <Field
                    label="Especificar rol *"
                  >
                    <input
                      type="text"
                      value={
                        externalRoleDetail
                      }
                      onChange={(e) =>
                        setExternalRoleDetail(
                          e.target.value
                        )
                      }
                      placeholder="Ej: Chofer, proveedor, make-up..."
                      autoFocus
                      className={inputClass}
                    />
                  </Field>

                  <p className="mt-2 text-[11px] text-zinc-600">
                    Este campo es obligatorio cuando elegís “Otro”.
                  </p>

                </div>
              )}

              <Field
                label="Estado"
              >
                <select
                  value={
                    externalAttendanceStatus
                  }
                  onChange={(e) =>
                    setExternalAttendanceStatus(
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  {attendanceStatuses.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </Field>

            </div>

            <div className="mt-4 flex justify-end">

              <button
                type="button"
                onClick={
                  addExternalParticipant
                }
                disabled={
                  savingExternal
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#20A4DD]/30 bg-[#20A4DD]/10 px-4 text-sm font-medium text-[#45B8E8] transition hover:bg-[#20A4DD]/15 disabled:opacity-50"
              >
                <Plus
                  size={15}
                />

                {savingExternal
                  ? "Agregando..."
                  : "Agregar externo"}
              </button>

            </div>

          </div>

          {externalParticipants.length ===
          0 ? (
            <EmptyState
              text="Todavía no hay participantes externos."
            />
          ) : (
            <div className="divide-y divide-white/5">

              {externalParticipants.map(
                (participant) => {

                  const external =
                    firstRelation(
                      participant.external
                    );

                  const role =
                    firstRelation(
                      participant.role
                    );

                  const roleLabel =
                    getRoleLabel(
                      role?.name,
                      participant.role_detail
                    );

                  return (
                    <div
                      key={
                        participant.id
                      }
                      className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_1fr_0.8fr_auto] md:items-center"
                    >

                      <div>
                        <p className="text-sm font-medium text-zinc-300">
                          {external?.full_name ??
                            "Participante externo"}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-700">

                          {external?.company && (
                            <span>
                              {external.company}
                            </span>
                          )}

                          {external?.email && (
                            <span>
                              {external.email}
                            </span>
                          )}

                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-700">
                          Rol
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          {roleLabel}
                        </p>
                      </div>

                      <select
                        value={
                          participant.attendance_status ??
                          "CONFIRMED"
                        }
                        onChange={(e) =>
                          updateExternalAttendance(
                            participant.id,
                            e.target.value
                          )
                        }
                        className={smallSelectClass}
                      >
                        {attendanceStatuses.map(
                          (item) => (
                            <option
                              key={
                                item.value
                              }
                              value={
                                item.value
                              }
                            >
                              {item.label}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          removeExternalParticipant(
                            participant.id
                          )
                        }
                        title="Quitar de la producción"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-red-900/40 hover:bg-red-950/20 hover:text-red-400"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

        <div className="mt-6 flex justify-end">

          <Link
            href={`/producciones/${productionId}`}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-[#0B0F12] px-5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            Volver a la producción
          </Link>

        </div>

      </div>

    </main>
  );
}

/*
 * =====================================
 * HELPERS
 * =====================================
 */

function normalizeRoleName(
  value?: string | null
) {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}

function getRoleLabel(
  roleName?: string,
  roleDetail?: string | null
) {
  if (!roleName) {
    return "Sin rol";
  }

  if (
    normalizeRoleName(
      roleName
    ) === "otro"
  ) {
    return roleDetail
      ? `Otro · ${roleDetail}`
      : "Otro";
  }

  return roleName;
}

function firstRelation(
  relation: any
) {
  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return (
    relation ??
    null
  );
}

/*
 * =====================================
 * COMPONENTES
 * =====================================
 */

function SectionHeader({
  title,
  subtitle,
  icon,
  count,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

      <div className="flex items-center gap-3">

        <div className="text-[#45B8E8]">
          {icon}
        </div>

        <div>

          <h2 className="text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-xs text-zinc-600">
            {subtitle}
          </p>

        </div>

      </div>

      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500">
        {count}
      </span>

    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>

      <label className="mb-2 block text-xs font-medium text-zinc-500">
        {label}
      </label>

      {children}

    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-10 text-center text-sm text-zinc-700">
      {text}
    </div>
  );
}

/*
 * =====================================
 * ESTILOS
 * =====================================
 */

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-[#050607] px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-[#20A4DD] focus:ring-1 focus:ring-[#20A4DD]/20";

const smallSelectClass =
  "h-9 rounded-lg border border-white/10 bg-[#050607] px-3 text-xs text-zinc-400 outline-none transition focus:border-[#20A4DD] [color-scheme:dark]";