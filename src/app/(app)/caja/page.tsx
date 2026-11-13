import Link from "next/link";
import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import { addDays, fmtDateTime, gs, todayISO, zonedToUtc } from "@/lib/utils";
import { Banknote, CreditCard, ArrowLeftRight, Undo2 } from "lucide-react";

export const metadata = { title: "Caja y pagos" };

export default async function Cashbox({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; metodo?: string }> }) {
  const ctx = await guard("caja");
  const sp = await searchParams;
  const today = todayISO(ctx.tz);
  const from = sp.desde ?? today, to = sp.hasta ?? today;
  let q = ctx.supabase.from("payments").select("id, amount, method, reference, is_refund, notes, paid_at, received_by, invoices(id, number, patients(first_name, last_name))")
    .eq("clinic_id", ctx.clinic.id)
    .gte("paid_at", zonedToUtc(`${from}T00:00`, ctx.tz).toISOString()).lt("paid_at", zonedToUtc(`${addDays(to, 1)}T00:00`, ctx.tz).toISOString())
    .order("paid_at", { ascending: false });
  if (sp.metodo) q = q.eq("method", sp.metodo);
  const [{ data }, { data: people }] = await Promise.all([q, ctx.supabase.from("profiles").select("id, full_name")]);
  const rows = data ?? [];
  const total = rows.reduce((a, p) => a + Number(p.amount), 0);
  const refunds = rows.filter((p) => p.is_refund).reduce((a, p) => a + Number(p.amount), 0);
  const byMethod = Object.keys(PAYMENT_METHODS).map((m) => ({ m, v: rows.filter((p) => p.method === m).reduce((a, p) => a + Number(p.amount), 0) })).filter((x) => x.v !== 0);

  return (
    <>
      <PageHeader title="Caja y pagos" description="Ingresos cobrados a pacientes. Los pagos se registran desde cada factura." />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Desde<input type="date" name="desde" defaultValue={from} className="input mt-1 w-auto" /></label>
        <label className="text-xs text-slate-500">Hasta<input type="date" name="hasta" defaultValue={to} className="input mt-1 w-auto" /></label>
        <select name="metodo" defaultValue={sp.metodo ?? ""} className="input w-auto"><option value="">Todos los métodos</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Ver</button>
        <Link href="/facturacion?estado=pendientes" className="ml-auto text-sm font-medium text-primary-600 hover:underline">Ver cuentas pendientes →</Link>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Ingreso neto del período" value={gs(total)} tone="green" icon={<Banknote className="h-5 w-5" />} />
        <Stat label="Movimientos" value={rows.length} icon={<ArrowLeftRight className="h-5 w-5" />} />
        <Stat label="Devoluciones" value={gs(-refunds)} tone="red" icon={<Undo2 className="h-5 w-5" />} />
        <Stat label="Por método" value={<span className="text-sm font-normal">{byMethod.map((x) => <span key={x.m} className="block">{PAYMENT_METHODS[x.m]}: <b>{gs(x.v)}</b></span>)}{!byMethod.length && "—"}</span>} icon={<CreditCard className="h-5 w-5" />} tone="sky" />
      </div>
      <Card padded={false}>
        {!rows.length ? <EmptyState title="Sin movimientos en el período" /> : (
          <table className="table-base">
            <thead><tr><th>Fecha y hora</th><th>Factura</th><th>Paciente</th><th>Método</th><th>Referencia</th><th>Registró</th><th className="text-right">Importe</th></tr></thead>
            <tbody>{rows.map((p) => {
              const inv = p.invoices as unknown as { id: string; number: string; patients: { first_name: string; last_name: string } };
              return (
                <tr key={p.id}>
                  <td>{fmtDateTime(p.paid_at, ctx.tz)}</td><td><Link href={`/facturacion/${inv.id}`} className="hover:text-primary-700">{inv.number}</Link></td>
                  <td>{inv.patients.last_name}, {inv.patients.first_name}</td>
                  <td>{PAYMENT_METHODS[p.method]}{p.is_refund && <Badge tone="red" className="ml-2">Devolución</Badge>}</td>
                  <td>{p.reference ?? "—"}</td><td className="text-xs text-slate-500">{people?.find((x) => x.id === p.received_by)?.full_name ?? "—"}</td>
                  <td className={`text-right font-medium tabular-nums ${Number(p.amount) < 0 ? "text-red-600" : ""}`}>{gs(p.amount)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
