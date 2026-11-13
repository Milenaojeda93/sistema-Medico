"use server";

import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, num, str } from "@/lib/utils";

function insurer(fd: FormData) {
  return {
    trade_name: str(fd, "trade_name"), legal_name: str(fd, "legal_name"), ruc: str(fd, "ruc"), address: str(fd, "address"),
    phone: str(fd, "phone"), email: str(fd, "email"), admin_contact: str(fd, "admin_contact"),
  };
}

export async function createInsurer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = insurer(fd);
  if (!p.trade_name) return { error: "El nombre comercial es obligatorio" };
  const { data, error } = await ctx.supabase.from("insurers").insert({ ...p, clinic_id: ctx.clinic.id }).select("id").single();
  if (error) return { error: dbError(error.message) };
  redirect(`/aseguradoras/${data.id}`);
}

export async function updateInsurer(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = insurer(fd);
  if (!p.trade_name) return { error: "El nombre comercial es obligatorio" };
  const { error } = await ctx.supabase.from("insurers").update({ ...p, active: fd.get("active") === "on" }).eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true, message: "Datos guardados" };
}

export async function createPlan(insurerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const name = str(fd, "name");
  if (!name) return { error: "Indicá el nombre del plan" };
  const { data, error } = await ctx.supabase.from("insurance_plans").insert({
    clinic_id: ctx.clinic.id, insurer_id: insurerId, name, deductible: num(fd, "deductible") ?? 0, annual_limit: num(fd, "annual_limit"), notes: str(fd, "notes"),
  }).select("id").single();
  if (error) return { error: dbError(error.message) };
  redirect(`/aseguradoras/${insurerId}/planes/${data.id}`);
}

export async function updatePlan(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("insurance_plans").update({
    name: str(fd, "name"), deductible: num(fd, "deductible") ?? 0, annual_limit: num(fd, "annual_limit"), notes: str(fd, "notes"), active: fd.get("active") === "on",
  }).eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true, message: "Plan actualizado" };
}

export async function saveCoverage(planId: string, coverageId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const category = str(fd, "category");
  if (!category) return { error: "Elegí la categoría" };
  const pct = num(fd, "coverage_percent") ?? 0;
  if (pct < 0 || pct > 100) return { error: "El porcentaje debe estar entre 0 y 100" };
  const payload = {
    clinic_id: ctx.clinic.id, plan_id: planId, category, specialty_id: str(fd, "specialty_id"),
    covered: fd.get("covered") === "on", coverage_percent: pct, copay: num(fd, "copay") ?? 0, max_amount: num(fd, "max_amount"),
    annual_quantity_limit: num(fd, "annual_quantity_limit"), requires_authorization: fd.get("requires_authorization") === "on", notes: str(fd, "notes"),
  };
  const res = coverageId
    ? await ctx.supabase.from("plan_coverages").update(payload).eq("id", coverageId)
    : await ctx.supabase.from("plan_coverages").insert(payload);
  if (res.error) return { error: res.error.message.includes("plan_coverages_uniq") ? "Ya existe una regla para esa categoría y especialidad en el plan" : dbError(res.error.message) };
  return { ok: true };
}

export async function deleteCoverage(id: string, _: ActionState, __: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("plan_coverages").delete().eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true };
}
