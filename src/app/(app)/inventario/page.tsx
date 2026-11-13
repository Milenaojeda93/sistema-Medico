import Link from "next/link";
import { AlertTriangle, Boxes, CalendarClock, PackagePlus, Plus, Skull } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, Stat, Tabs } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { createProduct, receiveStock, saveSupplier } from "./actions";
import { ProductFields, ReceiveFields } from "./forms";
import { stockInfo, type Lot } from "./stock";

export const metadata = { title: "Inventario" };

const KIND: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" }> = {
  entrada: { label: "Entrada", tone: "green" }, salida: { label: "Salida", tone: "amber" }, ajuste: { label: "Ajuste", tone: "red" }, dispensacion: { label: "Dispensación", tone: "blue" },
};

export default async function Inventory({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; filtro?: string }> }) {
  const ctx = await guard("inventario");
  const sp = await searchParams;
  const tab = sp.tab === "movimientos" || sp.tab === "proveedores" ? sp.tab : "productos";
  const today = todayISO(ctx.tz);
  const [{ data: products }, { data: suppliers }, { data: movs }] = await Promise.all([
    ctx.supabase.from("products").select("id, name, generic_name, presentation, category, unit, min_stock, active, stock_lots(id, quantity, expires_on, lot_number)").eq("clinic_id", ctx.clinic.id).order("name"),
    ctx.supabase.from("suppliers").select("*").eq("clinic_id", ctx.clinic.id).order("name"),
    tab === "movimientos" ? ctx.supabase.from("stock_movements").select("id, kind, quantity, reason, created_at, products(id, name, unit), stock_lots(lot_number)").eq("clinic_id", ctx.clinic.id).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
  ]);
  type P = { id: string; name: string; generic_name: string | null; presentation: string | null; category: string; unit: string; min_stock: number; active: boolean; stock_lots: Lot[] };
  const all = ((products ?? []) as unknown as P[]).map((p) => ({ ...p, info: stockInfo(p.stock_lots, p.min_stock, today) }));
  const active = all.filter((p) => p.active);
  const low = active.filter((p) => p.info.status.label === "Sin stock" || p.info.status.label === "Stock bajo");
  const soon = active.filter((p) => p.info.soonCount > 0);
  const expired = active.filter((p) => p.info.expired > 0);
  const q = (sp.q ?? "").toLowerCase().trim();
  let rows = all.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.generic_name ?? "").toLowerCase().includes(q));
  if (sp.filtro === "bajo") rows = rows.filter((p) => low.includes(p));
  if (sp.filtro === "vencer") rows = rows.filter((p) => soon.includes(p));
  if (sp.filtro === "vencidos") rows = rows.filter((p) => expired.includes(p));
  const supplierOpts = (suppliers ?? []).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <PageHeader title="Inventario" description="Medicamentos e insumos, lotes, vencimientos y movimientos de stock"
        actions={<>
          {can(ctx.perms, "inventario", "create") && active.length > 0 && (
            <Modal trigger={<><PackagePlus className="h-4 w-4" /> Ingreso de mercadería</>} title="Ingreso de mercadería" triggerVariant="secondary">
              <ActionForm action={receiveStock} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Producto" name="product_id" required className="sm:col-span-2">
                    <Select name="product_id" required defaultValue=""><option value="">Elegí…</option>{active.map((p) => <option key={p.id} value={p.id}>{p.name}{p.presentation ? ` · ${p.presentation}` : ""}</option>)}</Select>
                  </Field>
                  <Field label="Cantidad" name="quantity" required><Input name="quantity" type="number" min={0.01} step="any" required /></Field>
                  <Field label="Comprobante / nota" name="reason"><Input name="reason" placeholder="Ej.: Factura 001-001-1234" /></Field>
                </div>
                <ReceiveFields suppliers={supplierOpts} />
                <div className="flex justify-end"><SubmitButton>Registrar ingreso</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
          {can(ctx.perms, "inventario", "create") && (
            <Modal trigger={<><Plus className="h-4 w-4" /> Nuevo producto</>} title="Nuevo producto">
              <ActionForm action={createProduct} className="space-y-5">
                <ProductFields />
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="label">Stock inicial (opcional)</p>
                  <div className="mb-4"><Field label="Cantidad" name="initial_qty"><Input name="initial_qty" type="number" min={0} step="any" /></Field></div>
                  <ReceiveFields suppliers={supplierOpts} />
                </div>
                <div className="flex justify-end"><SubmitButton>Crear producto</SubmitButton></div>
              </ActionForm>
            </Modal>
          )}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/inventario"><Stat label="Productos activos" value={active.length} icon={<Boxes />} /></Link>
        <Link href="/inventario?filtro=bajo"><Stat label="Sin stock o stock bajo" value={low.length} hint="Por debajo del mínimo" icon={<AlertTriangle />} tone="amber" /></Link>
        <Link href="/inventario?filtro=vencer"><Stat label="Por vencer (60 días)" value={soon.length} icon={<CalendarClock />} tone="violet" /></Link>
        <Link href="/inventario?filtro=vencidos"><Stat label="Con lotes vencidos" value={expired.length} hint="Retiralos del stock" icon={<Skull />} tone="red" /></Link>
      </div>

      <Tabs active={tab} tabs={[{ key: "productos", label: "Productos", href: "/inventario" }, { key: "movimientos", label: "Movimientos", href: "/inventario?tab=movimientos" }, { key: "proveedores", label: "Proveedores", href: "/inventario?tab=proveedores" }]} />

      {tab === "productos" && (
        <Card padded={false}>
          <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar producto o genérico…" className="input max-w-sm" />
            {sp.filtro && <input type="hidden" name="filtro" value={sp.filtro} />}
            <button className="inline-flex h-9 items-center rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Buscar</button>
            {sp.filtro && <Link href="/inventario" className="inline-flex h-9 items-center px-2 text-sm text-primary-700 hover:underline">Quitar filtro</Link>}
          </form>
          {!rows.length ? <EmptyState title="Sin productos" description="Cargá medicamentos e insumos con “Nuevo producto”." /> : (
            <table className="table-base">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Stock disponible</th><th className="num">Mínimo</th><th>Próximo vencimiento</th><th>Estado</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td><Link href={`/inventario/${p.id}`} className="font-medium text-slate-900 hover:text-primary-700">{p.name}</Link><p className="text-xs text-slate-500">{[p.generic_name, p.presentation].filter(Boolean).join(" · ")}</p></td>
                    <td className="capitalize">{p.category}</td>
                    <td className="num font-semibold text-slate-900">{p.info.available.toLocaleString("es-PY")} <span className="text-xs font-normal text-slate-500">{p.unit}</span></td>
                    <td className="num text-slate-500">{Number(p.min_stock).toLocaleString("es-PY")}</td>
                    <td className="text-xs">{p.info.next ? fmtDate(p.info.next) : "—"}</td>
                    <td>{p.active ? <Badge tone={p.info.status.tone}>{p.info.status.label}</Badge> : <Badge>Inactivo</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "movimientos" && (
        <Card padded={false}>
          {!movs?.length ? <EmptyState title="Sin movimientos" /> : (
            <table className="table-base">
              <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th><th>Lote</th><th>Motivo</th></tr></thead>
              <tbody>
                {(movs as unknown as { id: string; kind: string; quantity: number; reason: string | null; created_at: string; products: { id: string; name: string; unit: string }; stock_lots: { lot_number: string | null } | null }[]).map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs">{fmtDateTime(m.created_at, ctx.tz)}</td>
                    <td><Link href={`/inventario/${m.products.id}`} className="hover:text-primary-700">{m.products.name}</Link></td>
                    <td><Badge tone={KIND[m.kind]?.tone ?? "gray"}>{KIND[m.kind]?.label ?? m.kind}</Badge></td>
                    <td className={`num font-medium ${Number(m.quantity) < 0 ? "text-rose-600" : "text-emerald-700"}`}>{Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity).toLocaleString("es-PY")}</td>
                    <td className="text-xs">{m.stock_lots?.lot_number ?? "—"}</td>
                    <td className="text-xs text-slate-600">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "proveedores" && (
        <Card padded={false} title="Proveedores" actions={can(ctx.perms, "inventario", "create") && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nuevo proveedor</>} title="Nuevo proveedor" triggerSize="sm" size="sm">
            <ActionForm action={saveSupplier.bind(null, null)} className="space-y-4">
              <Field label="Nombre" name="name" required><Input name="name" required /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="RUC" name="ruc"><Input name="ruc" /></Field>
                <Field label="Teléfono" name="phone"><Input name="phone" /></Field>
                <Field label="Correo" name="email"><Input name="email" type="email" /></Field>
                <Field label="Contacto" name="contact"><Input name="contact" /></Field>
              </div>
              <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
            </ActionForm>
          </Modal>
        )}>
          {!suppliers?.length ? <EmptyState title="Sin proveedores" /> : (
            <table className="table-base">
              <thead><tr><th>Proveedor</th><th>RUC</th><th>Teléfono</th><th>Correo</th><th>Contacto</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-900">{s.name}</td><td>{s.ruc ?? "—"}</td><td>{s.phone ?? "—"}</td><td>{s.email ?? "—"}</td><td>{s.contact ?? "—"}</td>
                    <td>{s.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className="text-right">{can(ctx.perms, "inventario", "edit") && (
                      <Modal trigger="Editar" title={`Editar · ${s.name}`} triggerVariant="ghost" triggerSize="sm" size="sm">
                        <ActionForm action={saveSupplier.bind(null, s.id)} className="space-y-4">
                          <Field label="Nombre" name="name" required><Input name="name" required defaultValue={s.name} /></Field>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="RUC" name="ruc"><Input name="ruc" defaultValue={s.ruc ?? ""} /></Field>
                            <Field label="Teléfono" name="phone"><Input name="phone" defaultValue={s.phone ?? ""} /></Field>
                            <Field label="Correo" name="email"><Input name="email" type="email" defaultValue={s.email ?? ""} /></Field>
                            <Field label="Contacto" name="contact"><Input name="contact" defaultValue={s.contact ?? ""} /></Field>
                          </div>
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> Activo</label>
                          <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                        </ActionForm>
                      </Modal>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}
