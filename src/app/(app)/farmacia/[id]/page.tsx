import Link from "next/link";
import { notFound } from "next/navigation";
import { guard, can } from "@/lib/context";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { fmtDateTime, todayISO } from "@/lib/utils";
import { stockInfo, type Lot } from "../../inventario/stock";
import { DispenseForm } from "../dispense-form";

export const metadata = { title: "Entrega de receta" };

export default async function DispensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("farmacia");
  const [{ data: r }, { data: products }, { data: movs }] = await Promise.all([
    ctx.supabase.from("prescriptions")
      .select("id, number, issued_at, status, diagnosis, patients(first_name, last_name, document, allergies), doctors(full_name, license_number), prescription_items(drug, presentation, dose, frequency, duration, quantity, position), dispensations(id, created_at, notes)")
      .eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle(),
    ctx.supabase.from("products").select("id, name, generic_name, presentation, unit, min_stock, stock_lots(id, quantity, expires_on, lot_number)").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("stock_movements").select("quantity, created_at, dispensation_id, products(name, unit), stock_lots(lot_number)").eq("clinic_id", ctx.clinic.id).eq("kind", "dispensacion").not("dispensation_id", "is", null).limit(500),
  ]);
  if (!r) notFound();
  const p = r.patients as unknown as { first_name: string; last_name: string; document: string; allergies: string | null };
  const d = r.doctors as unknown as { full_name: string; license_number: string };
  const lines = [...(r.prescription_items as { drug: string; presentation: string | null; dose: string | null; frequency: string | null; duration: string | null; quantity: string | null; position: number }[])].sort((a, b) => a.position - b.position);
  const disp = (r.dispensations ?? []) as { id: string; created_at: string; notes: string | null }[];
  const today = todayISO(ctx.tz);
  const opts = ((products ?? []) as unknown as { id: string; name: string; generic_name: string | null; presentation: string | null; unit: string; min_stock: number; stock_lots: Lot[] }[])
    .map((x) => ({ id: x.id, name: x.name, generic_name: x.generic_name, presentation: x.presentation, unit: x.unit, available: stockInfo(x.stock_lots, x.min_stock, today).available }));
  type M = { quantity: number; created_at: string; dispensation_id: string; products: { name: string; unit: string }; stock_lots: { lot_number: string | null } | null };
  const delivered = ((movs ?? []) as unknown as M[]).filter((m) => disp.some((x) => x.id === m.dispensation_id));

  return (
    <>
      <PageHeader back={{ href: "/farmacia", label: "Farmacia" }}
        title={<span className="flex items-center gap-3">Receta {r.number} {disp.length ? <Badge tone="green">Entregada</Badge> : <Badge tone="amber">Por entregar</Badge>}</span>}
        description={`${p.first_name} ${p.last_name} · CI ${p.document} · ${d.full_name} (Mat. ${d.license_number}) · ${fmtDateTime(r.issued_at, ctx.tz)}`}
        actions={can(ctx.perms, "recetas") && <Link href={`/recetas/${r.id}`} className="text-sm font-medium text-primary-700 hover:underline">Ver receta</Link>} />
      {r.status !== "emitida" && <div className="mb-4"><Notice tone="red">Esta receta está anulada y no puede entregarse.</Notice></div>}
      {p.allergies && <div className="mb-4"><Notice tone="red"><b>Alergias del paciente:</b> {p.allergies}</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title={disp.length ? "Registrar otra entrega" : "Entrega de medicamentos"}>
            {r.status === "emitida" && can(ctx.perms, "farmacia", "create")
              ? <DispenseForm prescriptionId={r.id} lines={lines} products={opts} />
              : <p className="text-sm text-slate-500">No tenés permiso para registrar entregas.</p>}
          </Card>
        </div>
        <Card title={`Entregas registradas (${disp.length})`}>
          {!disp.length ? <p className="text-sm text-slate-500">Todavía no se entregó nada de esta receta.</p> : (
            <ul className="space-y-4">
              {disp.map((x) => (
                <li key={x.id} className="text-sm">
                  <p className="font-medium text-slate-800">{fmtDateTime(x.created_at, ctx.tz)}</p>
                  <ul className="mt-1 text-slate-600">
                    {delivered.filter((m) => m.dispensation_id === x.id).map((m, i) => (
                      <li key={i}>• {m.products.name}: {Math.abs(Number(m.quantity)).toLocaleString("es-PY")} {m.products.unit}{m.stock_lots?.lot_number ? ` (lote ${m.stock_lots.lot_number})` : ""}</li>
                    ))}
                  </ul>
                  {x.notes && <p className="mt-1 text-xs text-slate-500">{x.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
