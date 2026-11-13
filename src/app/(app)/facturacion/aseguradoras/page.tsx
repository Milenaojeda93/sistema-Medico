import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { SETTLEMENT_STATUS } from "@/lib/constants";
import { addDays, fmtDate, gs, todayISO } from "@/lib/utils";
import { BillingTabs } from "../layout-tabs";
import { createSettlement } from "../actions";

export const metadata = { title: "Facturación a aseguradoras" };

export default async function InsurerBilling() {
  const ctx = await guard("facturacion");
  const [{ data: insurers }, { data: invoices }, { data: settlements }, { data: settled }] = await Promise.all([
    ctx.supabase.from("insurers").select("id, trade_name").eq("clinic_id", ctx.clinic.id).order("trade_name"),
    ctx.supabase.from("invoices").select("insurer_id, insurer_amount, invoice_items(id, insurer_amount)").eq("clinic_id", ctx.clinic.id).eq("care_type", "seguro").neq("status", "anulada"),
    ctx.supabase.from("insurer_settlements").select("*, insurers(trade_name)").eq("clinic_id", ctx.clinic.id).order("created_at", { ascending: false }),
    ctx.supabase.from("settlement_items").select("invoice_item_id").eq("clinic_id", ctx.clinic.id),
  ]);
  const settledIds = new Set((settled ?? []).map((s) => s.invoice_item_id));
  const summary = (insurers ?? []).map((ins) => {
    const invs = (invoices ?? []).filter((i) => i.insurer_id === ins.id);
    const billed = invs.reduce((a, i) => a + Number(i.insurer_amount), 0);
    const unsettled = invs.flatMap((i) => i.invoice_items as { id: string; insurer_amount: number }[]).filter((it) => Number(it.insurer_amount) > 0 && !settledIds.has(it.id)).reduce((a, it) => a + Number(it.insurer_amount), 0);
    const ss = (settlements ?? []).filter((s) => s.insurer_id === ins.id);
    const paid = ss.reduce((a, s) => a + Number(s.total_paid), 0);
    const rejected = ss.reduce((a, s) => a + Number(s.total_rejected), 0);
    return { ...ins, billed, unsettled, paid, rejected, receivable: billed - paid - rejected };
  }).filter((s) => s.billed > 0 || s.paid > 0);
  const today = todayISO(ctx.tz);

  return (
    <>
      <PageHeader title="Facturación" description="Liquidaciones, pagos y rechazos de aseguradoras"
        actions={can(ctx.perms, "facturacion", "create") && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nueva liquidación</>} title="Generar liquidación" size="sm">
            <ActionForm action={createSettlement} className="space-y-4">
              <Field label="Aseguradora" name="insurer_id" required><Select name="insurer_id" required><option value="">Seleccioná…</option>{insurers?.map((i) => <option key={i.id} value={i.id}>{i.trade_name}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Período desde" name="start" required><Input type="date" name="start" defaultValue={addDays(today, -30)} required /></Field>
                <Field label="Hasta" name="end" required><Input type="date" name="end" defaultValue={today} required /></Field>
              </div>
              <Field label="Notas" name="notes"><Textarea name="notes" rows={2} /></Field>
              <p className="text-xs text-slate-500">Incluye todas las prestaciones con importe a cargo de la aseguradora del período que aún no fueron liquidadas.</p>
              <div className="flex justify-end"><SubmitButton>Generar</SubmitButton></div>
            </ActionForm>
          </Modal>
        )} />
      <BillingTabs active="aseguradoras" />
      <Card title="Cuentas por cobrar por aseguradora" padded={false} className="mb-6">
        {!summary.length ? <EmptyState title="Sin facturación a aseguradoras" /> : (
          <table className="table-base">
            <thead><tr><th>Aseguradora</th><th className="text-right">Facturado</th><th className="text-right">Sin liquidar</th><th className="text-right">Cobrado</th><th className="text-right">Rechazado</th><th className="text-right">Por cobrar</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.id}><td className="font-medium">{s.trade_name}</td><td className="text-right tabular-nums">{gs(s.billed)}</td><td className="text-right tabular-nums text-amber-700">{gs(s.unsettled)}</td><td className="text-right tabular-nums text-green-700">{gs(s.paid)}</td><td className="text-right tabular-nums text-red-600">{gs(s.rejected)}</td><td className="text-right font-semibold tabular-nums">{gs(s.receivable)}</td></tr>
              ))}
              <tr className="bg-slate-50 font-semibold"><td>Total</td>
                {(["billed", "unsettled", "paid", "rejected", "receivable"] as const).map((k) => <td key={k} className="text-right tabular-nums">{gs(summary.reduce((a, s) => a + s[k], 0))}</td>)}
              </tr>
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Liquidaciones" padded={false}>
        {!settlements?.length ? <EmptyState title="Sin liquidaciones" description="Generá una liquidación para presentar a la aseguradora." /> : (
          <table className="table-base">
            <thead><tr><th>N°</th><th>Aseguradora</th><th>Período</th><th>Factura aseguradora</th><th className="text-right">Reclamado</th><th className="text-right">Rechazado</th><th className="text-right">Pagado</th><th>Estado</th></tr></thead>
            <tbody>{settlements.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/facturacion/aseguradoras/${s.id}`} className="font-medium hover:text-primary-700">{s.number}</Link></td>
                <td>{(s.insurers as { trade_name: string }).trade_name}</td><td>{fmtDate(s.period_start)} – {fmtDate(s.period_end)}</td>
                <td>{s.external_invoice_number ?? "—"}</td>
                <td className="text-right tabular-nums">{gs(s.total_claimed)}</td><td className="text-right tabular-nums text-red-600">{gs(s.total_rejected)}</td><td className="text-right tabular-nums text-green-700">{gs(s.total_paid)}</td>
                <td><StatusBadge map={SETTLEMENT_STATUS} value={s.status} /></td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
