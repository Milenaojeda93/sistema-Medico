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
  redirect(`/medicos/${data.id}`);
}

export async function updateDoctor(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = payload(fd);
  if (!p.full_name || !p.license_number) return { error: "Nombre y matrícula profesional son obligatorios" };
  const { error } = await ctx.supabase.from("doctors").update({ ...p, active: fd.get("active") === "on" }).eq("id", id);
  if (error) return { error: dbError(error.message) };
  const e = await syncSpecialties(ctx, id, fd);
  return e ? { error: e } : { ok: true, message: "Datos guardados" };
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
