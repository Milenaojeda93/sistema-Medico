"use server";

import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

export type LabItem = { study: string; category: "laboratorio" | "imagen" | "otro" };

export async function createLabOrder(input: {
  patientId: string; doctorId: string; consultationId: string | null; priority: "normal" | "urgente"; notes: string; items: LabItem[];
  location?: "interno" | "externo"; externalLab?: string;
}): Promise<{ id?: string; error?: string }> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "laboratorio", "create")) return { error: "No tenés permiso para pedir estudios" };
  const items = input.items.filter((i) => i.study.trim());
  if (!items.length) return { error: "Elegí al menos un estudio" };
  const { data, error } = await ctx.supabase.rpc("create_lab_order", {
    p_clinic: ctx.clinic.id, p_patient: input.patientId, p_doctor: input.doctorId, p_items: items,
    p_consultation: input.consultationId, p_priority: input.priority, p_notes: input.notes,
    p_location: input.location === "externo" ? "externo" : "interno", p_external_lab: input.externalLab?.trim() || null,
  });
  if (error) return { error: dbError(error.message) };
  return { id: data as string };
}

export async function saveLabResult(itemId: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "laboratorio", "edit") && !can(ctx.perms, "historias", "edit")) return { error: "No tenés permiso para cargar resultados" };
  const complete = fd.get("complete") === "1";
  const file = fd.get("file") as File | null;
  let path: string | null = null, name: string | null = null;
  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { error: "El archivo supera los 10 MB" };
    if (!/^(application\/pdf|image\/)/.test(file.type)) return { error: "Solo se aceptan PDF o imágenes" };
    path = `${ctx.clinic.id}/laboratorio/${orderId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await ctx.supabase.storage.from("documentos").upload(path, file, { contentType: file.type });
    if (error) return { error: dbError(error.message) };
    name = file.name;
  }
  const { error } = await ctx.supabase.rpc("save_lab_result", {
    p_item: itemId, p_result: str(fd, "result") ?? "", p_complete: complete, p_file_path: path, p_file_name: name,
  });
  if (error) return { error: dbError(error.message) };
  return { ok: true, message: complete ? "Resultado cargado" : "Borrador guardado" };
}

export async function voidLabOrder(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("void_lab_order", { p_order: id, p_reason: str(fd, "reason") ?? "" });
  return error ? { error: dbError(error.message) } : { ok: true, message: "Pedido anulado" };
}
