"use server";

import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, num, str } from "@/lib/utils";

function clinical(fd: FormData) {
  return {
    reason: str(fd, "reason"),
    symptoms: str(fd, "symptoms"),
    background: str(fd, "background"),
    bp_systolic: num(fd, "bp_systolic"),
    bp_diastolic: num(fd, "bp_diastolic"),
    temperature: num(fd, "temperature"),
    heart_rate: num(fd, "heart_rate"),
    respiratory_rate: num(fd, "respiratory_rate"),
    oxygen_saturation: num(fd, "oxygen_saturation"),
    weight_kg: num(fd, "weight_kg"),
    height_cm: num(fd, "height_cm"),
    diagnosis: str(fd, "diagnosis"),
    diagnosis_code: str(fd, "diagnosis_code"),
    observations: str(fd, "observations"),
    treatment: str(fd, "treatment"),
    instructions: str(fd, "instructions"),
    evolution: str(fd, "evolution"),
  };
}

function checkVitals(c: ReturnType<typeof clinical>) {
  const r = (v: number | null, lo: number, hi: number) => v === null || (v >= lo && v <= hi);
  if (!r(c.bp_systolic, 50, 260) || !r(c.bp_diastolic, 30, 160)) return "Presión arterial fuera de rango";
  if (!r(c.temperature, 30, 45)) return "Temperatura fuera de rango";
  if (!r(c.heart_rate, 20, 250)) return "Frecuencia cardíaca fuera de rango";
  if (!r(c.respiratory_rate, 4, 80)) return "Frecuencia respiratoria fuera de rango";
  if (!r(c.oxygen_saturation, 40, 100)) return "Saturación de oxígeno fuera de rango";
  if (!r(c.weight_kg, 0.3, 400) || !r(c.height_cm, 20, 250)) return "Peso o altura fuera de rango";
  return null;
}

export async function createConsultation(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "historias", "create")) return { error: "No tenés permiso para registrar consultas" };
  const c = clinical(fd);
  const patient_id = str(fd, "patient_id");
  const doctor_id = str(fd, "doctor_id");
  if (!patient_id || !doctor_id || !c.reason) return { error: "Paciente, profesional y motivo de consulta son obligatorios" };
  const v = checkVitals(c);
  if (v) return { error: v };
  const appointment_id = str(fd, "appointment_id");
  const { data, error } = await ctx.supabase.from("consultations").insert({
    ...c, clinic_id: ctx.clinic.id, patient_id, doctor_id, specialty_id: str(fd, "specialty_id"), appointment_id, created_by: ctx.user.id,
  }).select("id").single();
  if (error) return { error: dbError(error.message) };
  if (appointment_id) await ctx.supabase.from("appointments").update({ status: "en_atencion" }).eq("id", appointment_id).in("status", ["pendiente", "confirmada", "en_espera"]);
  if (fd.get("close") === "1") {
    const { error: e2 } = await ctx.supabase.rpc("close_consultation", { p_id: data.id });
    if (e2) return { error: "La consulta se guardó pero no se pudo cerrar: " + e2.message };
  }
  redirect(`/consultas/${data.id}`);
}

export async function updateConsultation(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const c = clinical(fd);
  if (!c.reason) return { error: "El motivo de consulta es obligatorio" };
  const v = checkVitals(c);
  if (v) return { error: v };
  const { error } = await ctx.supabase.from("consultations").update(c).eq("id", id).eq("status", "abierta");
  if (error) return { error: dbError(error.message) };
  if (fd.get("close") === "1") {
    const { error: e2 } = await ctx.supabase.rpc("close_consultation", { p_id: id });
    if (e2) return { error: e2.message };
  }
  return { ok: true, message: fd.get("close") === "1" ? "Consulta cerrada" : "Cambios guardados" };
}

export async function amendConsultation(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("amend_consultation", { p_id: id, p_field: str(fd, "field") ?? "", p_new_value: str(fd, "value") ?? "", p_reason: str(fd, "reason") ?? "" });
  return error ? { error: error.message } : { ok: true };
}
