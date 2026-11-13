"use server";

import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

function payload(fd: FormData) {
  return {
    full_name: str(fd, "full_name"), document: str(fd, "document"), license_number: str(fd, "license_number"),
    phone: str(fd, "phone"), email: str(fd, "email"), room_id: str(fd, "room_id"), user_id: str(fd, "user_id"),
    active: fd.get("active") !== null ? fd.get("active") === "on" : true,
  };
}

/** Guarda el costo de consulta particular por separado: si la columna aún no existe en la base, no rompe el guardado. */
async function saveFee(ctx: Awaited<ReturnType<typeof getCtx>>, doctorId: string, fd: FormData): Promise<string | null> {
  if (!fd.has("consultation_fee")) return null;
  const raw = String(fd.get("consultation_fee") ?? "").replace(/[^\d]/g, "");
  const fee = raw ? Number(raw) : null;
  const { error } = await ctx.supabase.from("doctors").update({ consultation_fee: fee }).eq("id", doctorId);
  if (error) return error.message.includes("consultation_fee") ? "Los datos se guardaron, pero el costo de consulta todavía no se puede guardar: falta aplicar la actualización 0011 en la base de datos." : dbError(error.message);
  return null;
}

async function syncSpecialties(ctx: Awaited<ReturnType<typeof getCtx>>, doctorId: string, fd: FormData) {
  const ids = fd.getAll("specialties").map(String);
  await ctx.supabase.from("doctor_specialties").delete().eq("doctor_id", doctorId);
  if (ids.length) {
    const { error } = await ctx.supabase.from("doctor_specialties").insert(ids.map((specialty_id) => ({ clinic_id: ctx.clinic.id, doctor_id: doctorId, specialty_id })));
    if (error) return dbError(error.message);
  }
  return null;
}

export async function createDoctor(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = payload(fd);
  if (!p.full_name || !p.license_number) return { error: "Nombre y matrícula profesional son obligatorios" };
  const { data, error } = await ctx.supabase.from("doctors").insert({ ...p, active: true, clinic_id: ctx.clinic.id }).select("id").single();
  if (error) return { error: error.message.includes("license") ? "Ya existe un profesional con esa matrícula" : dbError(error.message) };
  const e = await syncSpecialties(ctx, data.id, fd);
  if (e) return { error: e };
  await saveFee(ctx, data.id, fd);
  redirect(`/medicos/${data.id}`);
}

export async function updateDoctor(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = payload(fd);
  if (!p.full_name || !p.license_number) return { error: "Nombre y matrícula profesional son obligatorios" };
  const { error } = await ctx.supabase.from("doctors").update({ ...p, active: fd.get("active") === "on" }).eq("id", id);
  if (error) return { error: dbError(error.message) };
  const e = await syncSpecialties(ctx, id, fd);
  if (e) return { error: e };
  const f = await saveFee(ctx, id, fd);
  return f ? { error: f } : { ok: true, message: "Datos guardados" };
}

export async function addSchedule(doctorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const days = fd.getAll("weekday").map(Number);
  const start = str(fd, "start_time"), end = str(fd, "end_time");
  if (!days.length || !start || !end) return { error: "Elegí al menos un día y el horario" };
  if (end <= start) return { error: "La hora de fin debe ser posterior al inicio" };
  const { error } = await ctx.supabase.from("doctor_schedules").insert(days.map((weekday) => ({ clinic_id: ctx.clinic.id, doctor_id: doctorId, weekday, start_time: start, end_time: end, room_id: str(fd, "room_id") })));
  return error ? { error: dbError(error.message) } : { ok: true };
}

export async function deleteSchedule(id: string, _: ActionState, __: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("doctor_schedules").delete().eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true };
}


/** Guarda de una vez los seguros tildados del profesional (reemplaza la lista anterior). */
export async function saveDoctorInsurances(doctorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  let rows: { insurer_id: string; plan_id: string | null; coverage_percent: string; copay: string }[] = [];
  try { rows = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return { error: "Datos inválidos" }; }
  const clean = [];
  for (const r of rows) {
    const pct = r.coverage_percent === "" || r.coverage_percent == null ? null : Number(r.coverage_percent);
    if (pct != null && (isNaN(pct) || pct < 0 || pct > 100)) return { error: "El porcentaje debe estar entre 0 y 100" };
    const copay = r.copay === "" || r.copay == null ? null : Math.max(0, Number(String(r.copay).replace(/[^\d]/g, "")) || 0);
    if (pct == null && copay) return { error: "Para cargar un copago propio indicá también el % que cubre" };
    clean.push({ clinic_id: ctx.clinic.id, doctor_id: doctorId, insurer_id: r.insurer_id, plan_id: r.plan_id, coverage_percent: pct, copay: pct == null ? null : copay ?? 0 });
  }
  const del = await ctx.supabase.from("doctor_insurances").delete().eq("doctor_id", doctorId).eq("clinic_id", ctx.clinic.id);
  if (del.error) return { error: dbError(del.error.message) };
  if (clean.length) {
    const { error } = await ctx.supabase.from("doctor_insurances").insert(clean);
    if (error) return { error: dbError(error.message) };
  }
  return { ok: true, message: clean.length ? "Seguros guardados" : "Atiende todos los seguros" };
}
