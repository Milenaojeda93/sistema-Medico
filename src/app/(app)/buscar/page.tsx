import Link from "next/link";
import { getCtx, can } from "@/lib/context";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { INVOICE_STATUS } from "@/lib/constants";
import { fmtDate, gs } from "@/lib/utils";

export const metadata = { title: "Búsqueda" };

export default async function GlobalSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getCtx();
  const { q = "" } = await searchParams;
  const t = q.replace(/[%,()]/g, " ").trim();
  if (!t) return <EmptyState title="Escribí algo para buscar" />;
  const [patients, doctors, invoices] = await Promise.all([
    can(ctx.perms, "pacientes") ? ctx.supabase.from("patients").select("id, first_name, last_name, document, phone").eq("clinic_id", ctx.clinic.id)
      .or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,document.ilike.%${t.replace(/\./g, "")}%,phone.ilike.%${t}%`).limit(20) : Promise.resolve({ data: [] }),
    can(ctx.perms, "medicos") ? ctx.supabase.from("doctors").select("id, full_name, license_number").eq("clinic_id", ctx.clinic.id).or(`full_name.ilike.%${t}%,license_number.ilike.%${t}%`).limit(10) : Promise.resolve({ data: [] }),
    can(ctx.perms, "facturacion") ? ctx.supabase.from("invoices").select("id, number, issue_date, total, status").eq("clinic_id", ctx.clinic.id).ilike("number", `%${t}%`).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const none = !patients.data?.length && !doctors.data?.length && !invoices.data?.length;
  return (
    <>
      <PageHeader title={`Resultados para “${q}”`} />
      {none ? <Card><EmptyState title="Sin resultados" /></Card> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {!!patients.data?.length && (
            <Card title="Pacientes" padded={false} className="lg:col-span-2">
              <ul className="divide-y divide-slate-100">{patients.data.map((p) => (
                <li key={p.id}><Link href={`/pacientes/${p.id}`} className="flex justify-between px-5 py-3 hover:bg-slate-50"><span className="font-medium">{p.last_name}, {p.first_name}</span><span className="text-sm text-slate-500">CI {p.document} · {p.phone}</span></Link></li>
              ))}</ul>
            </Card>
          )}
          {!!doctors.data?.length && (
            <Card title="Profesionales" padded={false}>
              <ul className="divide-y divide-slate-100">{doctors.data.map((d) => <li key={d.id}><Link href={`/medicos/${d.id}`} className="flex justify-between px-5 py-3 hover:bg-slate-50"><span>{d.full_name}</span><span className="text-sm text-slate-500">{d.license_number}</span></Link></li>)}</ul>
            </Card>
          )}
          {!!invoices.data?.length && (
            <Card title="Facturas" padded={false}>
              <ul className="divide-y divide-slate-100">{invoices.data.map((i) => <li key={i.id}><Link href={`/facturacion/${i.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"><span>{i.number} · {fmtDate(i.issue_date)}</span><span className="flex items-center gap-2 text-sm">{gs(i.total)} <StatusBadge map={INVOICE_STATUS} value={i.status} /></span></Link></li>)}</ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
