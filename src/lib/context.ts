import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Action, ModuleKey } from "@/lib/constants";

export type Perms = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;

export type Clinic = { id: string; name: string; status: string; timezone: string; ruc: string | null; address: string | null; phone: string | null; email: string | null; city: string | null; doctors_see_own_only?: boolean };

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: members }, { data: isSuper }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("clinic_members").select("clinic_id, role, clinics(id, name, status, timezone, ruc, address, phone, email, city, doctors_see_own_only)").eq("user_id", user.id).eq("active", true),
    supabase.rpc("is_platform_admin"),
  ]);

  const memberships = (members ?? [])
    .filter((m) => m.clinics)
    .map((m) => ({ role: m.role as string, clinic: m.clinics as unknown as Clinic }));

  return { supabase, user, profile, memberships, isSuper: Boolean(isSuper) };
});

export const getCtx = cache(async () => {
  const s = await getSession();
  if (s.memberships.length === 0) {
    if (s.isSuper) redirect("/superadmin");
    redirect("/onboarding");
  }
  const store = await cookies();
  const wanted = store.get("clinic_id")?.value;
  const current = s.memberships.find((m) => m.clinic.id === wanted) ?? s.memberships[0];
  const clinic = current.clinic;

  const { data: rp } = await s.supabase
    .from("role_permissions")
    .select("module, can_view, can_create, can_edit, can_delete")
    .eq("clinic_id", clinic.id)
    .eq("role", current.role);

  const perms: Perms = {};
  for (const r of rp ?? []) perms[r.module] = { view: r.can_view, create: r.can_create, edit: r.can_edit, delete: r.can_delete };

  // Médico que solo ve lo propio (configurable por clínica)
  const ownOnly = current.role === "medico" && clinic.doctors_see_own_only !== false;
  const { data: mine } = await s.supabase.from("doctors").select("id").eq("clinic_id", clinic.id).eq("user_id", s.user.id);
  const myDoctorIds = (mine ?? []).map((d) => d.id as string);

  return { ...s, clinic, role: current.role, perms, ownOnly, myDoctorIds, tz: clinic.timezone || "America/Asuncion" };
});

export type Ctx = Awaited<ReturnType<typeof getCtx>>;

export function can(perms: Perms, module: ModuleKey | string, action: Action = "view") {
  return Boolean(perms[module]?.[action]);
}

export async function guard(module: ModuleKey, action: Action = "view") {
  const ctx = await getCtx();
  if (!["prueba", "activa"].includes(ctx.clinic.status)) redirect("/cuenta-suspendida");
  if (!can(ctx.perms, module, action)) redirect(`/sin-acceso?modulo=${module}`);
  return ctx;
}
