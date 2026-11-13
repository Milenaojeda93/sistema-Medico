"use server";

import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { MODULES } from "@/lib/constants";
import { dbError, str } from "@/lib/utils";

export async function addUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const email = str(fd, "email");
  if (!email) return { error: "Indicá el correo" };
  const { error } = await ctx.supabase.rpc("clinic_add_user", { p_clinic: ctx.clinic.id, p_email: email, p_full_name: str(fd, "full_name") ?? "", p_role: str(fd, "role") ?? "recepcionista", p_password: str(fd, "password") });
  return error ? { error: error.message } : { ok: true, message: "Usuario agregado" };
}

export async function updateMember(memberId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const role = str(fd, "role");
  const me = ctx.role;
  if (role === "admin_clinica" && me !== "admin_clinica") return { error: "Solo un Administrador de clínica puede asignar ese rol" };
  const { error } = await ctx.supabase.from("clinic_members").update({ role, active: fd.get("active") === "on" }).eq("id", memberId);
  return error ? { error: dbError(error.message) } : { ok: true };
}

export async function savePermissions(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "usuarios", "edit")) return { error: "No tenés permiso para modificar permisos" };
  const role = str(fd, "role");
  if (!role || role === "admin_clinica") return { error: "El rol Administrador de clínica siempre tiene acceso total" };
  const rows = MODULES.map((m) => ({
    clinic_id: ctx.clinic.id, role, module: m.key,
    can_view: fd.get(`${m.key}:view`) === "on", can_create: fd.get(`${m.key}:create`) === "on",
    can_edit: fd.get(`${m.key}:edit`) === "on", can_delete: fd.get(`${m.key}:delete`) === "on",
  }));
  for (const r of rows) {
    const { error } = await ctx.supabase.from("role_permissions").update(r).eq("clinic_id", ctx.clinic.id).eq("role", role).eq("module", r.module);
    if (error) return { error: dbError(error.message) };
  }
  return { ok: true, message: "Permisos actualizados" };
}
