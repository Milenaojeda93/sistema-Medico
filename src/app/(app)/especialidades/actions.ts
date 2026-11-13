"use server";

import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

export async function createSpecialty(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const name = str(fd, "name");
  if (!name) return { error: "Indicá el nombre" };
  const { error } = await ctx.supabase.from("specialties").insert({ clinic_id: ctx.clinic.id, name, description: str(fd, "description") });
  return error ? { error: dbError(error.message) } : { ok: true };
}

export async function toggleSpecialty(id: string, active: boolean, _: ActionState, __: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("specialties").update({ active }).eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true };
}
