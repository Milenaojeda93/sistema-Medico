"use server";

import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

export type RxItem = { drug: string; presentation: string; dose: string; frequency: string; duration: string; quantity: string; route: string; instructions: string };

export async function createPrescription(input: {
  patientId: string; doctorId: string; consultationId: string | null; diagnosis: string; notes: string; items: RxItem[];
}): Promise<{ id?: string; error?: string }> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "recetas", "create")) return { error: "No tenés permiso para emitir recetas" };
  const items = input.items.filter((i) => i.drug.trim());
  if (!items.length) return { error: "Agregá al menos un medicamento" };
  const { data, error } = await ctx.supabase.rpc("create_prescription", {
    p_clinic: ctx.clinic.id, p_patient: input.patientId, p_doctor: input.doctorId, p_items: items,
    p_consultation: input.consultationId, p_diagnosis: input.diagnosis, p_notes: input.notes,
  });
  if (error) return { error: dbError(error.message) };
  return { id: data as string };
}

export async function voidPrescription(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "recetas", "edit")) return { error: "No tenés permiso para anular recetas" };
  const reason = str(fd, "reason");
  if (!reason) return { error: "Indicá el motivo de la anulación" };
  const { error } = await ctx.supabase.from("prescriptions").update({ status: "anulada", void_reason: reason }).eq("id", id).eq("clinic_id", ctx.clinic.id);
  return error ? { error: dbError(error.message) } : { ok: true, message: "Receta anulada" };
}
