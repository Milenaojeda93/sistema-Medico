"use server";

import { getCtx } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, str } from "@/lib/utils";

export async function createAuthorization(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const patient_id = str(fd, "patient_id"), patient_insurance_id = str(fd, "patient_insurance_id");
  const service_id = str(fd, "service_id");
  let desc = str(fd, "service_description");
  if (!patient_id || !patient_insurance_id) return { error: "Paciente y seguro son obligatorios" };
  if (!desc && service_id) {
    const { data } = await ctx.supabase.from("services").select("name").eq("id", service_id).single();
    desc = data?.name ?? null;
  }
  if (!desc) return { error: "Indicá el servicio solicitado" };
  const { data: inserted, error } = await ctx.supabase.from("authorizations").insert({
    clinic_id: ctx.clinic.id, patient_id, patient_insurance_id, service_id, service_description: desc,
    doctor_id: str(fd, "doctor_id"), request_number: str(fd, "request_number"), request_date: str(fd, "request_date") ?? undefined,
    notes: str(fd, "notes"), created_by: ctx.user.id,
  }).select("id").single();
  if (error) return { error: dbError(error.message) };
  const file = fd.get("file") as File | null;
  if (file && file.size > 0) {
    const path = `${ctx.clinic.id}/autorizaciones/${inserted.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await ctx.supabase.storage.from("documentos").upload(path, file, { contentType: file.type });
    if (!up.error) await ctx.supabase.from("patient_documents").insert({ clinic_id: ctx.clinic.id, patient_id, authorization_id: inserted.id, name: `Orden / solicitud ${desc}`, category: "autorizacion", storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: ctx.user.id });
  }
  return { ok: true };
}

export async function updateAuthorization(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const status = str(fd, "status");
  const authorization_number = str(fd, "authorization_number");
  if (status === "aprobada" && !authorization_number) return { error: "Para aprobar, cargá el número de autorización otorgado por la aseguradora" };
  const { error } = await ctx.supabase.from("authorizations").update({
    status, authorization_number, response_date: str(fd, "response_date"), valid_until: str(fd, "valid_until"), notes: str(fd, "notes"),
  }).eq("id", id);
  return error ? { error: dbError(error.message) } : { ok: true };
}
