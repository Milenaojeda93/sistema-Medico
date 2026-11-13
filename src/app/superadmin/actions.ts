"use server";

import { getSession } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { str } from "@/lib/utils";

export async function updateClinicAdmin(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s.isSuper) return { error: "Acceso restringido" };
  const { error } = await s.supabase.rpc("admin_update_clinic", { p_clinic: id, p_status: str(fd, "status") ?? "activa", p_plan: str(fd, "plan") ?? "basico", p_ends: str(fd, "ends") });
  return error ? { error: error.message } : { ok: true };
}
