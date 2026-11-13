"use server";

import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, num, str } from "@/lib/utils";

export async function updateClinic(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const name = str(fd, "name");
  if (!name) return { error: "El nombre es obligatorio" };
  const { error } = await ctx.supabase.from("clinics").update({
    name, legal_name: str(fd, "legal_name"), ruc: str(fd, "ruc"), address: str(fd, "address"), city: str(fd, "city"),
    country: str(fd, "country"), phone: str(fd, "phone"), email: str(fd, "email"),
    doctors_see_own_only: fd.get("doctors_see_own_only") === "on",
  }).eq("id", ctx.clinic.id);
  return error ? { error: dbError(error.message) } : { ok: true, message: "Datos de la institución guardados" };
}

export async function saveRoom(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const name = str(fd, "name");
  if (!name) return { error: "Indicá el nombre" };
  const payload = { name, location: str(fd, "location"), active: id ? fd.get("active") === "on" : true };
  const res = id ? await ctx.supabase.from("rooms").update(payload).eq("id", id) : await ctx.supabase.from("rooms").insert({ ...payload, clinic_id: ctx.clinic.id });
  return res.error ? { error: dbError(res.error.message) } : { ok: true };
}

export async function saveService(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const name = str(fd, "name"), price = num(fd, "price");
  if (!name || price === null || price < 0) return { error: "Nombre y precio válido son obligatorios" };
  const payload = { name, code: str(fd, "code"), category: str(fd, "category") ?? "consulta", specialty_id: str(fd, "specialty_id"), price, active: id ? fd.get("active") === "on" : true };
  const res = id ? await ctx.supabase.from("services").update(payload).eq("id", id) : await ctx.supabase.from("services").insert({ ...payload, clinic_id: ctx.clinic.id });
  return res.error ? { error: dbError(res.error.message) } : { ok: true };
}
