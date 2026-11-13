import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { ActionForm, Modal, PrintButton, SubmitButton } from "@/components/ui/client";
import { INVOICE_STATUS, PAYMENT_METHODS } from "@/lib/constants";
import { fmtDate, fmtDateTime, gs } from "@/lib/utils";
import { registerPayment, voidInvoice } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("facturacion");
  const { data: inv } = await ctx.supabase.from("invoices")
    .select("*, patients(id, first_name, last_name, document, address, phone), insurers(trade_name, ruc), patient_insurances(member_number, insurance_plans(name)), invoice_items(*, authorizations(authorization_number), settlement_items(status, rejected_amount, rejection_reason, insurer_settlements(id, number)))")
    .eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!inv) notFound();
  const { data: payments } = can(ctx.perms, "caja") ? await ctx.supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at") : { data: [] };
  const p = inv.patients as { id: string; first_name: string; last_name: string; document: string; address: string | null; phone: string | null };
  const pi = inv.patient_insurances as { member_number: string; insurance_plans: { name: string } } | null;
  const items = inv.invoice_items as Array<{ id: string; description: string; quantity: number; unit_price: number; line_total: number; covered: boolean; coverage_percent: number; copay: number; insurer_amount: number; patient_amount: number; coverage_note: string | null; authorizations: { authorization_number: string | null } | null; settlement_items: { status: string; rejected_amount: number; rejection_reason: string | null; insurer_settlements: { id: string; number: string } }[] | { status: string; rejected_amount: number; rejection_reason: string | null; insurer_settlements: { id: string; number: string } } | null }>;
  const balance = Number(inv.patient_amount) - Number(inv.patient_paid);
  const canPay = can(ctx.perms, "caja", "create") && inv.status !== "anulada";

  return (
    <>
      <div className="no-print">
        <PageHeader back={{ href: "/facturacion", label: "Facturación" }}
          title={<span className="flex items-center gap-3">Factura {inv.number} <StatusBadge map={INVOICE_STATUS} value={inv.status} /></span>}
          description={`${fmtDate(inv.issue_date)} · ${p.first_name} ${p.last_name}`}
          actions={<>
            <PrintButton label="Imprimir comprobante" />
            {canPay && balance > 0 && (
              <Modal trigger="Registrar pago" title={`Registrar pago · saldo ${gs(balance)}`} size="sm">
                <ActionForm action={registerPayment.bind(null, id, false)} className="space-y-4">
                  <Field label="Importe (Gs.)" name="amount" required><Input name="amount" type="number" min={1} max={balance} defaultValue={balance} required /></Field>
                  <Field label="Método de pago" name="method"><Select name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  <Field label="Referencia / N° comprobante" name="reference"><Input name="reference" /></Field>
                  <div className="flex justify-end"><SubmitButton variant="success">Registrar pago</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
            {canPay && Number(inv.patient_paid) > 0 && (
              <Modal trigger="Devolución" title="Registrar devolución" size="sm" triggerVariant="secondary">
                <ActionForm action={registerPayment.bind(null, id, true)} className="space-y-4">
                  <Field label={`Importe a devolver (máx. ${gs(inv.patient_paid)})`} name="amount" required><Input name="amount" type="number" min={1} max={Number(inv.patient_paid)} required /></Field>
                  <Field label="Método" name="method"><Select name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  <Field label="Motivo" name="notes" required><Textarea name="notes" rows={2} required /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">Registrar devolución</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
            {can(ctx.perms, "facturacion", "delete") && inv.status !== "anulada" && (
              <Modal trigger="Anular" title="Anular factura" size="sm" triggerVariant="ghost">
                <ActionForm action={voidInvoice.bind(null, id)} className="space-y-4">
                  <p className="text-sm text-slate-600">La factura quedará registrada como anulada y no se podrá revertir.</p>
                  <Field label="Motivo" name="reason" required><Input name="reason" required /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">Anular factura</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
          </>} />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-6 border-b border-slate-100 pb-5">
          <div>
            <p className="text-lg font-semibold text-slate-900">{ctx.clinic.name}</p>
            <p className="text-sm text-slate-500">{ctx.clinic.ruc && `RUC ${ctx.clinic.ruc} · `}{ctx.clinic.address} {ctx.clinic.city}</p>
            <p className="text-sm text-slate-500">{ctx.clinic.phone} {ctx.clinic.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Comprobante interno</p>
            <p className="text-xl font-semibold">{inv.number}</p>
            <p className="text-sm text-slate-500">Emisión {fmtDate(inv.issue_date)}</p>
          </div>
        </div>
        <div className="grid gap-6 border-b border-slate-100 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Paciente</p>
            <Link href={`/pacientes/${p.id}`} className="font-medium text-slate-900 hover:text-primary-700">{p.first_name} {p.last_name}</Link>
            <p className="text-sm text-slate-500">CI {p.document}{p.phone ? ` · ${p.phone}` : ""}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Tipo de atención</p>
            {inv.care_type === "seguro" ? (
              <p className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-4 w-4 text-primary-600" /> {(inv.insurers as { trade_name: string }).trade_name} — {pi?.insurance_plans.name} · afiliado {pi?.member_number}</p>
            ) : <p className="font-medium">Particular</p>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Servicio</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Importe</th><th>Cobertura</th><th className="text-right">Aseguradora</th><th className="text-right">Paciente</th></tr></thead>
            <tbody>{items.map((it) => {
              const si = Array.isArray(it.settlement_items) ? it.settlement_items[0] : it.settlement_items;
              return (
                <tr key={it.id}>
                  <td>{it.description}{it.authorizations?.authorization_number && <p className="text-xs text-slate-500">Autorización {it.authorizations.authorization_number}</p>}</td>
                  <td className="text-right">{it.quantity}</td><td className="text-right tabular-nums">{gs(it.unit_price)}</td><td className="text-right tabular-nums">{gs(it.line_total)}</td>
                  <td className="text-xs">{it.covered ? <Badge tone="blue">{it.coverage_note}</Badge> : <span className="text-slate-500">{it.coverage_note}</span>}
                    {si && <p className="mt-1 no-print"><Link className="text-primary-600 hover:underline" href={`/facturacion/aseguradoras/${si.insurer_settlements.id}`}>{si.insurer_settlements.number}</Link>{si.status === "rechazado" && <span className="text-red-600"> · rechazo {gs(si.rejected_amount)}</span>}</p>}</td>
                  <td className="text-right tabular-nums">{gs(it.insurer_amount)}</td><td className="text-right tabular-nums">{gs(it.patient_amount)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Importe total</dt><dd className="tabular-nums">{gs(inv.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Cubierto por aseguradora</dt><dd className="tabular-nums">{gs(inv.insurer_amount)}</dd></div>
            {Number(inv.discount) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Descuento</dt><dd className="tabular-nums">− {gs(inv.discount)}</dd></div>}
            <div className="flex justify-between font-medium"><dt>Correspondiente al paciente</dt><dd className="tabular-nums">{gs(inv.patient_amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pagado</dt><dd className="tabular-nums text-green-700">{gs(inv.patient_paid)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold"><dt>Saldo pendiente</dt><dd className="tabular-nums">{gs(balance)}</dd></div>
          </dl>
        </div>
        {inv.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-500">{inv.notes}</p>}
      </Card>

      {!!payments?.length && (
        <Card title="Pagos y devoluciones" padded={false} className="mt-6 no-print">
          <table className="table-base">
            <thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th>Notas</th><th className="text-right">Importe</th></tr></thead>
            <tbody>{payments.map((pm) => (
              <tr key={pm.id}><td>{fmtDateTime(pm.paid_at, ctx.tz)}</td><td>{PAYMENT_METHODS[pm.method]}{pm.is_refund && <Badge tone="red" className="ml-2">Devolución</Badge>}</td><td>{pm.reference ?? "—"}</td><td>{pm.notes ?? ""}</td><td className="text-right tabular-nums">{gs(pm.amount)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
