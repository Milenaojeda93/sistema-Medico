import Link from "next/link";
import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { addDays, fmtDateTime, todayISO, zonedToUtc } from "@/lib/utils";

export const metadata = { title: "Farmacia" };

export default async function Pharmacy({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string }> }) {
  const ctx = await guard("farmacia");
  const sp = await searchParams;
  const view = sp.ver === "entregadas" ? "entregadas" : "pendientes";
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, " ");
  const since = zonedToUtc(`${addDays(todayISO(ctx.tz), -90)}T00:00`, ctx.tz).toISOString();
  let query = ctx.supabase.from("prescriptions")
    .select("id, number, issued_at, patients!inner(first_name, last_name, document), doctors(full_name), prescription_items(drug), dispensations(id, created_at)")
    .eq("clinic_id", ctx.clinic.id).eq("status", "emitida").gte("issued_at", since).order("issued_at", { ascending: false }).limit(300);
  if (q) query = /^\d+$/.test(q) ? query.ilike("patients.document", `%${q}%`) : query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: "patients" });
  const { data } = await query;
  type Row = { id: string; number: string; issued_at: string; patients: { first_name: string; last_name: string; document: string }; doctors: { full_name: string }; prescription_items: { drug: string }[]; dispensations: { id: string; created_at: string }[] };
  const all = (data ?? []) as unknown as Row[];
  const rows = all.filter((r) => (view === "pendientes" ? r.dispensations.length === 0 : r.dispensations.length > 0));

  return (
    <>
      <PageHeader title="Farmacia" description="Entrega de medicamentos de las recetas emitidas. El stock se descuenta automáticamente del inventario." />
      <Tabs active={view} tabs={[{ key: "pendientes", label: "Recetas por entregar", href: "/farmacia" }, { key: "entregadas", label: "Entregadas", href: "/farmacia?ver=entregadas" }]} />
      <Card padded={false}>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          {view === "entregadas" && <input type="hidden" name="ver" value="entregadas" />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por paciente o documento…" className="input max-w-sm" />
          <button className="inline-flex h-9 items-center rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Buscar</button>
          <span className="ml-auto self-center text-xs text-slate-500">Recetas de los últimos 90 días</span>
        </form>
        {!rows.length ? <EmptyState title={view === "pendientes" ? "No hay recetas por entregar" : "Sin entregas"} /> : (
          <table className="table-base">
            <thead><tr><th>Receta</th><th>Fecha</th><th>Paciente</th><th>Médico</th><th>Medicamentos</th><th>{view === "pendientes" ? "" : "Entregada"}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/farmacia/${r.id}`} className="font-medium text-slate-900 hover:text-primary-700">{r.number}</Link></td>
                  <td className="text-xs">{fmtDateTime(r.issued_at, ctx.tz)}</td>
                  <td>{r.patients.last_name}, {r.patients.first_name}<p className="text-xs text-slate-500">CI {r.patients.document}</p></td>
                  <td>{r.doctors.full_name}</td>
                  <td className="max-w-xs truncate text-xs text-slate-600">{r.prescription_items.map((i) => i.drug).join(", ")}</td>
                  <td className="text-right">{view === "pendientes"
                    ? <Link href={`/farmacia/${r.id}`} className="inline-flex h-8 items-center rounded-[10px] bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700">Entregar</Link>
                    : <Badge tone="green">{fmtDateTime(r.dispensations[0].created_at, ctx.tz)}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
