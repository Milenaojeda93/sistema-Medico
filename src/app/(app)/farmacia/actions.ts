"use server";

import { getCtx, can } from "@/lib/context";
import { dbError } from "@/lib/utils";

export async function dispensePrescription(prescriptionId: string, items: { product_id: string; quantity: number }[], notes: string): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "farmacia", "create")) return { error: "No tenés permiso para dispensar" };
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (!clean.length) return { error: "Indicá al menos un producto y su cantidad" };
  const { error } = await ctx.supabase.rpc("dispense_prescription", { p_clinic: ctx.clinic.id, p_prescription: prescriptionId, p_items: clean, p_notes: notes });
  return error ? { error: dbError(error.message) } : { ok: true };
}
