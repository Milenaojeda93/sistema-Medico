import Link from "next/link";
import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { labStatus } from "./constants";

export const metadata = { title: "Laboratorio y estudios" };

const VIEWS = { pendientes: "Pendientes del laboratorio", externos: "Externos (afuera)", completados: "Resultados listos", anulados: "Anulados", todos: "Todos" } as const;

export default async function Lab({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string }> }) {
  const ctx = await guard("laboratorio");
  const sp = await searchParams;
  const view = (sp.ver && sp.ver in VIEWS ? sp.ver : "pendientes") as keyof typeof VIEWS;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, " ");
  let query = ctx.supabase.from("lab_orders")
    .select("id, number, ordered_at, status, priority, location, external_lab, patients!inner(id, first_name, last_name, document), doctors(full_name), lab_order_items(study, status)")
    .eq("clinic_id", ctx.clinic.id).limit(300);
  if (view === "pendientes") query = query.eq("location", "interno").in("status", ["solicitado", "en_proceso"]).order("priority", { ascending: false }).order("ordered_at");
  else if (view === "externos") query = query.eq("location", "externo").in("status", ["solicitado", "en_proceso"]).order("ordered_at", { ascending: false });
  else {
    query = query.order("ordered_at", { ascending: false });
    if (view === "completados") query = query.eq("status", "completado");
    if (view === "anulados") query = query.eq("status", "anulado");
  }
  if (q) query = /^\d+$/.test(q) ? query.ilike("patients.document", `%${q}%`) : query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: "patients" });
  const { data } = await query;
  type Row = { id: string; number: string; ordered_at: string; status: string; priority: string; location: string; external_lab: string | null; patients: { id: string; first_name: string; last_name: string; document: string }; doctors: { full_name: string }; lab_order_items: { study: string; status: string }[] };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Laboratorio y estudios" description="Pedidos enviados desde las consultas. Cargá los resultados y el médico los ve al instante." />
      <Tabs active={view} tabs={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v, href: `/laboratorio?ver=${k}` }))} />
      <Card padded={false}>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input type="hidden" name="ver" value={view} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por paciente o documento…" className="input max-w-sm" />
          <button className="inline-flex h-9 items-center rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Buscar</button>
        </form>
        {!rows.length ? <EmptyState title={view === "pendientes" ? "No hay estudios pendientes" : view === "externos" ? "No hay estudios externos esperando resultados" : "Sin pedidos"} description={view === "externos" ? "Son estudios que el paciente se hace en otro laboratorio. Los resultados los adjunta el médico cuando el paciente vuelve." : "Los pedidos se generan desde la consulta del paciente."} /> : (
          <table className="table-base">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Paciente</th><th>Solicitado por</th><th>Estudios</th><th>Avance</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const done = r.lab_order_items.filter((i) => i.status === "completado").length;
                return (
                  <tr key={r.id}>
                    <td><Link href={`/laboratorio/${r.id}`} className="font-medium text-slate-900 hover:text-primary-700">{r.number}</Link>{r.priority === "urgente" && <Badge tone="red" className="ml-2">Urgente</Badge>}{r.location === "externo" && <p className="text-xs text-slate-500">Afuera{r.external_lab ? ` · ${r.external_lab}` : ""}</p>}</td>
                    <td className="text-xs">{fmtDateTime(r.ordered_at, ctx.tz)}</td>
                    <td>{r.patients.last_name}, {r.patients.first_name}<p className="text-xs text-slate-500">CI {r.patients.document}</p></td>
                    <td>{r.doctors.full_name}</td>
                    <td className="max-w-xs truncate text-xs text-slate-600">{r.lab_order_items.map((i) => i.study).join(", ")}</td>
                    <td className="tabular text-xs">{done}/{r.lab_order_items.length}</td>
                    <td>{(() => { const st = labStatus(r); return <Badge tone={st.tone}>{st.label}</Badge>; })()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
