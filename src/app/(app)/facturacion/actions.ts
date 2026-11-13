"use server";

import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { num, str } from "@/lib/utils";

export type PreviewLine = { covered: boolean; coverage_percent: number; copay: number; insurer_amount: number; patient_amount: number; requires_authorization: boolean; authorization_id: string | null; note: string };

export async function previewCoverage(patientInsuranceId: string | null, items: { service_id: string; quantity: number; unit_price: number }[]): Promise<{ lines?: PreviewLine[]; error?: string }> {
  const ctx = await getCtx();
  const lines: PreviewLine[] = [];
  for (const it of items) {
    if (!it.service_id) { lines.push({ covered: false, coverage_percent: 0, copay: 0, insurer_amount: 0, patient_amount: 0, requires_authorization: false, authorization_id: null, note: "" }); continue; }
    const { data, error } = await ctx.supabase.rpc("compute_coverage", { p_patient_insurance: patientInsuranceId, p_service: it.service_id, p_unit_price: it.unit_price, p_quantity: it.quantity });
    if (error) return { error: error.message };
    const r = (data as PreviewLine[])[0];
    lines.push({ ...r, insurer_amount: Number(r.insurer_amount), patient_amount: Number(r.patient_amount), copay: Number(r.copay), coverage_percent: Number(r.coverage_percent) });
  }
  return { lines };
}

export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  let items: { service_id: string; quantity: number; unit_price: number }[] = [];
  try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { return { error: "Ítems inválidos" }; }
  items = items.filter((i) => i.service_id);
  if (!str(fd, "patient_id")) return { error: "Seleccioná el paciente" };
  if (!items.length) return { error: "Agregá al menos un servicio" };
  const { data, error } = await ctx.supabase.rpc("create_invoice", {
    p_clinic: ctx.clinic.id, p_patient: str(fd, "patient_id")!, p_patient_insurance: str(fd, "patient_insurance_id"),
    p_items: items, p_discount: num(fd, "discount") ?? 0, p_appointment: str(fd, "appointment_id"), p_consultation: str(fd, "consultation_id"), p_notes: str(fd, "notes"),
  });
  if (error) return { error: error.message };
  redirect(`/facturacion/${data}`);
}

export async function registerPayment(invoiceId: string, refund: boolean, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("register_payment", {
    p_invoice: invoiceId, p_amount: num(fd, "amount") ?? 0, p_method: str(fd, "method") ?? "efectivo", p_reference: str(fd, "reference"), p_is_refund: refund, p_notes: str(fd, "notes"),
  });
  return error ? { error: error.message } : { ok: true };
}

export async function voidInvoice(invoiceId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const reason = str(fd, "reason");
  if (!reason) return { error: "Indicá el motivo de la anulación" };
  const { error } = await ctx.supabase.rpc("void_invoice", { p_invoice: invoiceId, p_reason: reason });
  return error ? { error: error.message } : { ok: true };
}

export async function createSettlement(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { data, error } = await ctx.supabase.rpc("create_settlement", {
    p_clinic: ctx.clinic.id, p_insurer: str(fd, "insurer_id") ?? "", p_start: str(fd, "start") ?? "", p_end: str(fd, "end") ?? "", p_notes: str(fd, "notes"),
  });
  if (error) return { error: error.message };
  redirect(`/facturacion/aseguradoras/${data}`);
}

export async function submitSettlement(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("submit_settlement", { p_settlement: id, p_external_number: str(fd, "external") ?? "" });
  return error ? { error: error.message } : { ok: true };
}

export async function rejectItem(itemId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("reject_settlement_item", { p_item: itemId, p_amount: num(fd, "amount") ?? 0, p_reason: str(fd, "reason") ?? "" });
  return error ? { error: error.message } : { ok: true };
}

export async function insurerPayment(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("register_insurer_payment", { p_settlement: id, p_amount: num(fd, "amount") ?? 0, p_date: str(fd, "date") ?? "", p_reference: str(fd, "reference") ?? "" });
  return error ? { error: error.message } : { ok: true };
}
