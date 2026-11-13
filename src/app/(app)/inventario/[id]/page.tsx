import { notFound } from "next/navigation";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, Stat } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { fmtDate, fmtDateTime, gs, todayISO, addDays } from "@/lib/utils";
import { receiveStock, updateProduct, withdrawStock } from "../actions";
import { ProductFields, ReceiveFields } from "../forms";
import { stockInfo, type Lot } from "../stock";

export const metadata = { title: "Producto" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("inventario");
  const today = todayISO(ctx.tz);
  const [{ data: p }, { data: lots }, { data: movs }, { data: suppliers }] = await Promise.all([
    ctx.supabase.from("products").select("*").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle(),
    ctx.supabase.from("stock_lots").select("id, lot_number, expires_on, quantity, unit_cost, received_at, suppliers(name)").eq("product_id", id).order("expires_on", { nullsFirst: false }),
    ctx.supabase.from("stock_movements").select("id, kind, quantity, reason, created_at, stock_lots(lot_number)").eq("product_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("suppliers").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
  ]);
  if (!p) notFound();
  const info = stockInfo((lots ?? []) as Lot[], p.min_stock, today);
  const withStock = (lots ?? []).filter((l) => Number(l.quantity) > 0);

  return (
    <>
      <PageHeader back={{ href: "/inventario", label: "Inventario" }}
        title={<span className="flex flex-wrap items-center gap-3">{p.name} <Badge tone={info.status.tone}>{info.status.label}</Badge>{!p.active && <Badge>Inactivo</Badge>}</span>}
        description={[p.generic_name, p.presentation, p.category].filter(Boolean).join(" · ")}
        actions={<>
          {can(ctx.perms, "inventario", "create") && (
            <Modal trigger="Ingreso" title={`Ingreso · ${p.name}`}>
              <ActionForm action={receiveStock} className="space-y-4">
                <input type="hidden" name="product_id" value={p.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Cantidad (${p.unit})`} name="quantity" required><Input name="quantity" type="number" min={0.01} step="any" required /></Field>
                  <Field label="Comprobante / nota" name="reason"><Input name="reason" /></Field>
                </div>
                <ReceiveFields suppliers={suppliers ?? []} />
                <div className="flex justify-end"><SubmitButton>Registrar ingreso</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
          {can(ctx.perms, "inventario", "edit") && withStock.length > 0 && (
            <Modal trigger="Salida / ajuste" title={`Salida o ajuste · ${p.name}`} triggerVariant="secondary" size="sm">
              <ActionForm action={withdrawStock.bind(null, p.id)} className="space-y-4">
                <Field label="Tipo" name="kind"><Select name="kind" defaultValue="salida"><option value="salida">Salida (uso interno, rotura, vencido)</option><option value="ajuste">Ajuste de inventario (corrección)</option></Select></Field>
                <Field label={`Cantidad a descontar (${p.unit})`} name="quantity" required><Input name="quantity" type="number" min={0.01} step="any" required /></Field>
                <Field label="Lote" name="lot_id" hint="Si no elegís, se descuenta primero lo que vence antes.">
                  <Select name="lot_id" defaultValue=""><option value="">Automático</option>{withStock.map((l) => <option key={l.id} value={l.id}>{l.lot_number ?? "Sin lote"} · vence {fmtDate(l.expires_on)} · {Number(l.quantity)}</option>)}</Select>
                </Field>
                <Field label="Motivo" name="reason" required><Input name="reason" required placeholder="Ej.: lote vencido descartado" /></Field>
                <div className="flex justify-end"><SubmitButton variant="danger">Registrar</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stock disponible" value={`${info.available.toLocaleString("es-PY")} ${p.unit}`} hint={`Mínimo: ${Number(p.min_stock).toLocaleString("es-PY")}`} />
        <Stat label="Próximo vencimiento" value={info.next ? fmtDate(info.next) : "—"} tone="violet" />
        <Stat label="Vencido (no usable)" value={info.expired.toLocaleString("es-PY")} tone="red" />
        <Stat label="Precio de venta" value={p.sale_price != null ? gs(p.sale_price) : "—"} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Lotes" padded={false}>
            {!lots?.length ? <EmptyState title="Sin lotes" description="Registrá un ingreso de mercadería." /> : (
              <table className="table-base">
                <thead><tr><th>Lote</th><th>Vencimiento</th><th className="num">Cantidad</th><th className="num">Costo unit.</th><th>Proveedor</th><th>Ingreso</th></tr></thead>
                <tbody>
                  {lots.map((l) => {
                    const exp = l.expires_on && l.expires_on < today, soon = l.expires_on && !exp && l.expires_on <= addDays(today, 60);
                    return (
                      <tr key={l.id} className={Number(l.quantity) === 0 ? "opacity-50" : ""}>
                        <td className="font-medium">{l.lot_number ?? "Sin lote"}</td>
                        <td>{fmtDate(l.expires_on)} {exp ? <Badge tone="red">Vencido</Badge> : soon ? <Badge tone="violet">Por vencer</Badge> : null}</td>
                        <td className="num font-semibold">{Number(l.quantity).toLocaleString("es-PY")}</td>
                        <td className="num">{l.unit_cost != null ? gs(l.unit_cost) : "—"}</td>
                        <td className="text-xs">{(l.suppliers as unknown as { name: string } | null)?.name ?? "—"}</td>
                        <td className="text-xs">{fmtDateTime(l.received_at, ctx.tz)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Movimientos" padded={false}>
            {!movs?.length ? <EmptyState title="Sin movimientos" /> : (
              <table className="table-base">
                <thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Cantidad</th><th>Lote</th><th>Motivo</th></tr></thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id}>
                      <td className="text-xs">{fmtDateTime(m.created_at, ctx.tz)}</td>
                      <td className="capitalize">{m.kind === "dispensacion" ? "Dispensación" : m.kind}</td>
                      <td className={`num font-medium ${Number(m.quantity) < 0 ? "text-rose-600" : "text-emerald-700"}`}>{Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity).toLocaleString("es-PY")}</td>
                      <td className="text-xs">{(m.stock_lots as unknown as { lot_number: string | null } | null)?.lot_number ?? "—"}</td>
                      <td className="text-xs text-slate-600">{m.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <Card title="Datos del producto">
          {can(ctx.perms, "inventario", "edit") ? (
            <ActionForm action={updateProduct.bind(null, p.id)} className="space-y-4">
              <ProductFields p={p} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Producto activo</label>
              <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
            </ActionForm>
          ) : <p className="text-sm text-slate-500">Sin permiso para editar.</p>}
        </Card>
      </div>
    </>
  );
}
