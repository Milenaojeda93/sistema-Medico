import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Card, EmptyState, LinkButton, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { INVOICE_STATUS } from "@/lib/constants";
import { fmtDate, gs } from "@/lib/utils";
import { BillingTabs } from "./layout-tabs";

export const metadata = { title: "Facturación" };

export default async function Billing({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string; desde?: string; hasta?: string; q?: string }> }) {
  const ctx = await guard("facturacion");
  const sp = await searchParams;
  let q = ctx.supabase.from("invoices").select("id, number, issue_date, care_type, total, insurer_amount, patient_amount, patient_paid, status, patients(first_name, last_name, document), insurers(trade_name)")
    .eq("clinic_id", ctx.clinic.id).order("issue_date", { ascending: false }).order("number", { ascending: false }).limit(300);
  if (sp.estado === "pendientes") q = q.in("status", ["pendiente", "parcial"]); else if (sp.estado) q = q.eq("status", sp.estado);
  if (sp.tipo) q = q.eq("care_type", sp.tipo);
  if (sp.desde) q = q.gte("issue_date", sp.desde);
  if (sp.hasta) q = q.lte("issue_date", sp.hasta);
  if (sp.q) q = q.ilike("number", `%${sp.q}%`);
  const { data } = await q;
  const valid = (data ?? []).filter((i) => i.status !== "anulada");
  const sum = (f: (i: (typeof valid)[number]) => number) => valid.reduce((a, i) => a + f(i), 0);

  return (
    <>
      <PageHeader title="Facturación" description="Servicios facturados, coberturas y saldos"
        actions={can(ctx.perms, "facturacion", "create") && <LinkButton href="/facturacion/nueva"><Plus className="h-4 w-4" /> Nueva factura</LinkButton>} />
      <BillingTabs active="particular" />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total facturado (filtro)" value={gs(sum((i) => Number(i.total)))} />
        <Stat label="A cargo de aseguradoras" value={gs(sum((i) => Number(i.insurer_amount)))} tone="violet" />
        <Stat label="A cargo de pacientes" value={gs(sum((i) => Number(i.patient_amount)))} tone="sky" />
        <Stat label="Saldo pendiente de pacientes" value={gs(sum((i) => Number(i.patient_amount) - Number(i.patient_paid)))} tone="red" />
      </div>
      <Card padded={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input name="q" defaultValue={sp.q} placeholder="N° de factura" className="input w-36" />
          <select name="tipo" defaultValue={sp.tipo ?? ""} className="input w-auto"><option value="">Particular y seguro</option><option value="particular">Particular</option><option value="seguro">Por seguro</option></select>
          <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto"><option value="">Todos los estados</option><option value="pendientes">Con saldo pendiente</option>{Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <input type="date" name="desde" defaultValue={sp.desde} className="input w-auto" /><input type="date" name="hasta" defaultValue={sp.hasta} className="input w-auto" />
          <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Filtrar</button>
        </form>
        {!data?.length ? <EmptyState title="Sin facturas" /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Factura</th><th>Fecha</th><th>Paciente</th><th>Tipo</th><th className="text-right">Total</th><th className="text-right">Aseguradora</th><th className="text-right">Paciente</th><th className="text-right">Saldo</th><th>Estado</th></tr></thead>
              <tbody>{data.map((i) => {
                const p = i.patients as unknown as { first_name: string; last_name: string };
                return (
                  <tr key={i.id} className={i.status === "anulada" ? "opacity-50" : ""}>
                    <td><Link href={`/facturacion/${i.id}`} className="font-medium hover:text-primary-700">{i.number}</Link></td>
                    <td>{fmtDate(i.issue_date)}</td><td>{p.last_name}, {p.first_name}</td>
                    <td>{i.care_type === "seguro" ? (i.insurers as unknown as { trade_name: string })?.trade_name : "Particular"}</td>
                    <td className="text-right tabular-nums">{gs(i.total)}</td><td className="text-right tabular-nums">{gs(i.insurer_amount)}</td>
                    <td className="text-right tabular-nums">{gs(i.patient_amount)}</td>
                    <td className="text-right tabular-nums font-medium">{gs(Number(i.patient_amount) - Number(i.patient_paid))}</td>
                    <td><StatusBadge map={INVOICE_STATUS} value={i.status} /></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
