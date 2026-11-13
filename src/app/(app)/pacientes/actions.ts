"use server";

import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

function patientPayload(fd: FormData) {
  return {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    document: str(fd, "document")?.replace(/\./g, "") ?? null,
    birth_date: str(fd, "birth_date"),
    sex: str(fd, "sex"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    country: str(fd, "country") ?? "Paraguay",
    emergency_contact_name: str(fd, "emergency_contact_name"),
    emergency_contact_phone: str(fd, "emergency_contact_phone"),
    blood_type: str(fd, "blood_type"),
    allergies: str(fd, "allergies"),
    medical_history: str(fd, "medical_history"),
    preexisting_conditions: str(fd, "preexisting_conditions"),
    current_medications: str(fd, "current_medications"),
  };
}

function validate(p: ReturnType<typeof patientPayload>) {
  if (!p.first_name || !p.last_name || !p.document) return "Nombre, apellido y documento son obligatorios";
  if (p.birth_date && new Date(p.birth_date) > new Date()) return "La fecha de nacimiento no puede ser futura";
  if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) return "El correo electrónico no es válido";
  return null;
}

export async function createPatient(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "pacientes", "create")) return { error: "No tenés permiso para registrar pacientes" };
  const p = patientPayload(fd);
  const v = validate(p);
  if (v) return { error: v };

  const { data: dupDoc } = await ctx.supabase.from("patients").select("id, first_name, last_name").eq("clinic_id", ctx.clinic.id).eq("document", p.document!).maybeSingle();
  if (dupDoc) return { error: `Ya existe un paciente con el documento ${p.document}: ${dupDoc.first_name} ${dupDoc.last_name}` };

  if (fd.get("confirm_duplicate") !== "1" && p.birth_date) {
    const { data: similar } = await ctx.supabase.from("patients").select("document").eq("clinic_id", ctx.clinic.id)
      .ilike("first_name", p.first_name!).ilike("last_name", p.last_name!).eq("birth_date", p.birth_date).limit(1);
    if (similar?.length) return { error: `Hay un paciente con el mismo nombre y fecha de nacimiento (documento ${similar[0].document}). Si es otra persona, marcá "Confirmo que no es un duplicado" y guardá de nuevo.` };
  }

  const { data, error } = await ctx.supabase.from("patients").insert({ ...p, clinic_id: ctx.clinic.id, created_by: ctx.user.id }).select("id").single();
  if (error) return { error: dbError(error.message) };
  redirect(`/pacientes/${data.id}`);
}

export async function updatePatient(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const p = patientPayload(fd);
  const v = validate(p);
  if (v) return { error: v };
  const { error } = await ctx.supabase.from("patients").update(p).eq("id", id).eq("clinic_id", ctx.clinic.id);
  if (error) return { error: dbError(error.message) };
  redirect(`/pacientes/${id}`);
}

export async function toggleArchive(id: string, archived: boolean, _: ActionState, __: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("patients").update({ archived }).eq("id", id).eq("clinic_id", ctx.clinic.id);
  return error ? { error: dbError(error.message) } : { ok: true };
}

export async function saveInsurance(patientId: string, insuranceId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const planId = str(fd, "plan_id");
  if (!planId || !str(fd, "member_number") || !str(fd, "start_date")) return { error: "Plan, número de afiliado e inicio de cobertura son obligatorios" };
  const { data: plan } = await ctx.supabase.from("insurance_plans").select("insurer_id").eq("id", planId).single();
  const payload = {
    clinic_id: ctx.clinic.id,
    patient_id: patientId,
    insurer_id: plan?.insurer_id,
    plan_id: planId,
    member_number: str(fd, "member_number"),
    policy_number: str(fd, "policy_number"),
    holder_name: str(fd, "holder_name"),
    relationship: str(fd, "relationship") ?? "Titular",
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    status: str(fd, "status") ?? "activo",
    notes: str(fd, "notes"),
  };
  let id = insuranceId;
  if (insuranceId) {
    const { error } = await ctx.supabase.from("patient_insurances").update(payload).eq("id", insuranceId);
    if (error) return { error: dbError(error.message) };
  } else {
    const { data, error } = await ctx.supabase.from("patient_insurances").insert(payload).select("id").single();
    if (error) return { error: dbError(error.message) };
    id = data.id;
  }
  const card = fd.get("card") as File | null;
  if (card && card.size > 0) {
    const path = `${ctx.clinic.id}/seguros/${id}/${Date.now()}-${card.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await ctx.supabase.storage.from("documentos").upload(path, card, { contentType: card.type });
    if (upErr) return { error: "Seguro guardado, pero no se pudo subir la tarjeta: " + upErr.message };
    await ctx.supabase.from("patient_insurances").update({ card_path: path }).eq("id", id!);
    await ctx.supabase.from("patient_documents").insert({ clinic_id: ctx.clinic.id, patient_id: patientId, patient_insurance_id: id, name: "Tarjeta del seguro", category: "seguro", storage_path: path, mime_type: card.type, size_bytes: card.size, uploaded_by: ctx.user.id });
  }
  return { ok: true };
}

export async function uploadDocument(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Seleccioná un archivo" };
  if (file.size > 10 * 1024 * 1024) return { error: "El archivo supera los 10 MB" };
  const path = `${ctx.clinic.id}/pacientes/${patientId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await ctx.supabase.storage.from("documentos").upload(path, file, { contentType: file.type });
  if (error) return { error: dbError(error.message) };
  const { error: e2 } = await ctx.supabase.from("patient_documents").insert({
    clinic_id: ctx.clinic.id, patient_id: patientId, name: str(fd, "name") ?? file.name, category: str(fd, "category") ?? "general",
    storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: ctx.user.id,
  });
  return e2 ? { error: dbError(e2.message) } : { ok: true };
}
