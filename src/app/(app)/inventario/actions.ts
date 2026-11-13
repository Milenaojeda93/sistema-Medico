"use server";

import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/context";
import type { ActionState } from "@/components/ui/client";
import { dbError, num, str } from "@/lib/utils";

function productPayload(fd: FormData) {
  return {
    name: str(fd, "name"), generic_name: str(fd, "generic_name"), presentation: str(fd, "presentation"),
    category: ["medicamento", "insumo", "otro"].includes(str(fd, "category") ?? "") ? str(fd, "category") : "medicamento",
    unit: str(fd, "unit") ?? "unidad", min_stock: num(fd, "min_stock") ?? 0, sale_price: num(fd, "sale_price"),
  };
}

export async function createProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "inventario", "create")) return { error: "No tenés permiso para crear productos" };
  const p = productPayload(fd);
  if (!p.name) return { error: "El nombre es obligatorio" };
  const { data, error } = await ctx.supabase.from("products").insert({ ...p, clinic_id: ctx.clinic.id }).select("id").single();
  if (error) return { error: dbError(error.message) };
  const qty = num(fd, "initial_qty");
  if (qty && qty > 0) {
    const { error: e2 } = await ctx.supabase.rpc("receive_stock", {
      p_clinic: ctx.clinic.id, p_product: data.id, p_quantity: qty, p_lot: str(fd, "lot"), p_expires: str(fd, "expires_on"),
      p_cost: num(fd, "unit_cost"), p_supplier: str(fd, "supplier_id"), p_reason: "Stock inicial",
    });
    if (e2) return { error: "Producto creado, pero no se pudo cargar el stock: " + dbError(e2.message) };
  }
  redirect(`/inventario/${data.id}`);
}

export async function updateProduct(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.perms, "inventario", "edit")) return { error: "No tenés permiso para editar productos" };
  const p = productPayload(fd);
  if (!p.name) return { error: "El nombre es obligatorio" };
  const { error } = await ctx.supabase.from("products").update({ ...p, active: fd.get("active") === "on" }).eq("id", id).eq("clinic_id", ctx.clinic.id);
  return error ? { error: dbError(error.message) } : { ok: true, message: "Producto actualizado" };
}

export async function receiveStock(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const product = str(fd, "product_id");
  if (!product) return { error: "Elegí el producto" };
  const { error } = await ctx.supabase.rpc("receive_stock", {
    p_clinic: ctx.clinic.id, p_product: product, p_quantity: num(fd, "quantity") ?? 0, p_lot: str(fd, "lot"),
    p_expires: str(fd, "expires_on"), p_cost: num(fd, "unit_cost"), p_supplier: str(fd, "supplier_id"), p_reason: str(fd, "reason") ?? "Ingreso de mercadería",
  });
  return error ? { error: dbError(error.message) } : { ok: true, message: "Ingreso registrado" };
}

export async function withdrawStock(productId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.rpc("withdraw_stock", {
    p_clinic: ctx.clinic.id, p_product: productId, p_quantity: num(fd, "quantity") ?? 0,
    p_kind: str(fd, "kind") ?? "salida", p_reason: str(fd, "reason") ?? "", p_lot: str(fd, "lot_id"),
  });
  return error ? { error: dbError(error.message) } : { ok: true, message: "Movimiento registrado" };
}

export async function saveSupplier(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getCtx();
  const payload = { name: str(fd, "name"), ruc: str(fd, "ruc"), phone: str(fd, "phone"), email: str(fd, "email"), contact: str(fd, "contact") };
  if (!payload.name) return { error: "El nombre es obligatorio" };
  const res = id
    ? await ctx.supabase.from("suppliers").update({ ...payload, active: fd.get("active") === "on" }).eq("id", id).eq("clinic_id", ctx.clinic.id)
    : await ctx.supabase.from("suppliers").insert({ ...payload, clinic_id: ctx.clinic.id });
  return res.error ? { error: dbError(res.error.message) } : { ok: true, message: "Proveedor guardado" };
}
