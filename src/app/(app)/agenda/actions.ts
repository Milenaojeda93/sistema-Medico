"use server";

import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str, zonedToUtc } from "@/lib/utils";

const STATUSES = ["pendiente", "confirmada", "en_espera", "en_atencion", "atendida", "cancelada", "ausente"];

export async function saveAppointment(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "agenda", id ? "edit" : "create")) return { error: "No tenés permiso para gestionar la agenda" };
  const patient_id = str(fd, "patient_id");
  const doctor_id = str(fd, "doctor_id");
  const when = str(fd, "starts_at");
  const duration = Number(str(fd, "duration") ?? 30);
  const care_type = str(fd, "care_type") ?? "particular";
  const patient_insurance_id = care_type === "seguro" ? str(fd, "patient_insurance_id") : null;
  if (!patient_id || !doctor_id || !when) return { error: "Paciente, profesional y fecha/hora son obligatorios" };
  if (care_type === "seguro" && !patient_insurance_id) return { error: "Seleccioná el seguro del paciente para una atención por seguro" };
  if (!(duration >= 5 && duration <= 480)) return { error: "Duración inválida" };

  const start = zonedToUtc(when, ctx.tz);
  const end = new Date(start.getTime() + duration * 60000);

  if (patient_insurance_id) {
    const { data: pi } = await ctx.supabase.from("v_patient_insurances").select("effective_status").eq("id", patient_insurance_id).single();
    if (pi && pi.effective_status !== "activo") return { error: `El seguro seleccionado está ${pi.effective_status}. Agendá como particular o actualizá el seguro.` };
  }

  const payload = {
    clinic_id: ctx.clinic.id, patient_id, doctor_id,
    specialty_id: str(fd, "specialty_id"), room_id: str(fd, "room_id"),
    starts_at: start.toISOString(), ends_at: end.toISOString(),
    reason: str(fd, "reason"), care_type, patient_insurance_id,
    status: str(fd, "status") ?? "pendiente", notes: str(fd, "notes"),
  };
  const res = id
    ? await ctx.supabase.from("appointments").update(payload).eq("id", id)
    : await ctx.supabase.from("appointments").insert({ ...payload, created_by: ctx.user.id });
  if (res.error) return { error: dbError(res.error.message) };
  return { ok: true };
}

export async function setAppointmentStatus(id: string, status: string, _: ActionState, __: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!STATUSES.includes(status)) return { error: "Estado inválido" };
  const { error } = await ctx.supabase.from("appointments").update({ status }).eq("id", id).eq("clinic_id", ctx.clinic.id);
  return error ? { error: dbError(error.message) } : { ok: true };
}
