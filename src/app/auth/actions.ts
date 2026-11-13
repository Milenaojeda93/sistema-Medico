"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ui/client";
import { str } from "@/lib/utils";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { error: "Ingresá tu correo y contraseña" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message };
  const next = str(fd, "next");
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function register(_: ActionState, fd: FormData): Promise<ActionState> {
  const full_name = str(fd, "full_name");
  const email = str(fd, "email");
  const password = str(fd, "password");
  const clinic = str(fd, "clinic");
  if (!full_name || !email || !password || !clinic) return { error: "Completá todos los campos" };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, pending_clinic: clinic } } });
  if (error) return { error: error.message.includes("already registered") ? "Ese correo ya tiene una cuenta. Iniciá sesión." : error.message };
  if (!data.session) {
    return { ok: true, message: "Te enviamos un correo para confirmar tu cuenta. Después de confirmarlo, iniciá sesión para terminar de crear tu institución." };
  }
  const { data: clinicId, error: e2 } = await supabase.rpc("create_clinic", { p_name: clinic });
  if (e2) return { error: e2.message };
  (await cookies()).set("clinic_id", clinicId as string, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
  redirect("/dashboard");
}

export async function createClinic(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: clinicId, error } = await supabase.rpc("create_clinic", {
    p_name: str(fd, "name") ?? "",
    p_ruc: str(fd, "ruc"),
    p_phone: str(fd, "phone"),
    p_email: str(fd, "email"),
    p_city: str(fd, "city"),
    p_address: str(fd, "address"),
  });
  if (error) return { error: error.message };
  (await cookies()).set("clinic_id", clinicId as string, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("clinic_id");
  redirect("/login");
}

export async function switchClinic(fd: FormData) {
  const id = str(fd, "clinic_id");
  if (id) (await cookies()).set("clinic_id", id, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
  redirect("/dashboard");
}
