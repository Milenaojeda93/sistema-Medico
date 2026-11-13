import Link from "next/link";
import { notFound } from "next/navigation";
import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { ActionForm, Modal, PrintButton, SubmitButton } from "@/components/ui/client";
import { SETTLEMENT_STATUS } from "@/lib/constants";
import { fmtDate, gs, todayISO } from "@/lib/utils";
import { insurerPayment, rejectItem, submitSettlement } from "../../actions";

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("facturacion");
  const [{ data: s }, { data: items }, { data: pays }] = await Promise.all([
    ctx.supabase.from("insurer_settlements").select("*, insurers(trade_name, ruc)").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle(),
    ctx.supabase.from("settlement_items").select("*, invoice_items(description, quantity, line_total, coverage_percent, invoices(id, number, issue_date, patients(first_name, last_name, document), patient_insurances(member_number)), authorizations(authorization_number))").eq("settlement_id", id),
    ctx.supabase.from("insurer_payments").select("*").eq("settlement_id", id).order("paid_at"),
  ]);
  if (!s) notFound();
  const editable = can(ctx.perms, "facturacion", "edit");
  const pending = Number(s.total_claimed) - Number(s.total_rejected) - Number(s.total_paid);
  type Row = { id: string; amount: number; status: string; rejected_amount: number; rejection_reason: string | null; invoice_items: { description: string; quantity: number; line_total: number; coverage_percent: number; invoices: { id: string; number: string; issue_date: string; patients: { first_name: string; last_name: string; document: string }; patient_insurances: { member_number: string } | null }; authorizations: { authorization_number: string | null } | null } };
  const rows = ((items ?? []) as unknown as Row[]).sort((a, b) => a.invoice_items.invoices.issue_date.localeCompare(b.invoice_items.invoices.issue_date));

  return (
    <>
      <div className="no-print">
        <PageHeader back={{ href: "/facturacion/aseguradoras", label: "Facturación a aseguradoras" }}
          title={<span className="flex items-center gap-3">Liquidación {s.number} <StatusBadge map={SETTLEMENT_STATUS} value={s.status} /></span>}
          description={`${(s.insurers as { trade_name: string }).trade_name} · período ${fmtDate(s.period_start)} – ${fmtDate(s.period_end)}${s.submitted_at ? ` · presentada ${fmtDate(s.submitted_at)}` : ""}`}
          actions={<>
            <PrintButton label="Imprimir liquidación" />
            {editable && s.status === "borrador" && (
              <Modal trigger="Presentar a la aseguradora" title="Presentar liquidación" size="sm">
                <ActionForm action={submitSettlement.bind(null, id)} className="space-y-4">
                  <Field label="N° de factura emitida a la aseguradora" name="external" required><Input name="external" placeholder="001-001-0000000" required /></Field>
                  <div className="flex justify-end"><SubmitButton>Marcar como presentada</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
            {editable && s.status !== "borrador" && pending > 0 && (
              <Modal trigger="Registrar pago recibido" title={`Pago de la aseguradora · pendiente ${gs(pending)}`} size="sm" triggerVariant="success">
                <ActionForm action={insurerPayment.bind(null, id)} className="space-y-4">
                  <Field label="Importe (Gs.)" name="amount" required><Input name="amount" type="number" min={1} max={pending} defaultValue={pending} required /></Field>
                  <Field label="Fecha" name="date"><Input name="date" type="date" defaultValue={todayISO(ctx.tz)} /></Field>
                  <Field label="Referencia (transferencia / cheque)" name="reference"><Input name="reference" /></Field>
                  <div className="flex justify-end"><SubmitButton variant="success">Registrar</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
          </>} />
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Reclamado" value={gs(s.total_claimed)} />
          <Stat label="Rechazado" value={gs(s.total_rejected)} tone="red" />
          <Stat label="Pagado" value={gs(s.total_paid)} tone="green" />
          <Stat label="Pendiente de cobro" value={gs(pending)} tone="amber" />
        </div>
      </div>
      <Card title={`Prestaciones incluidas (${rows.length})${s.external_invoice_number ? ` · Factura ${s.external_invoice_number}` : ""}`} padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Fecha</th><th>Comprobante</th><th>Paciente</th><th>Afiliado</th><th>Prestación</th><th>Autoriz.</th><th className="text-right">Importe</th><th className="text-right">Cobertura</th><th className="text-right">Reclamado</th><th>Estado</th><th className="no-print" /></tr></thead>
            <tbody>{rows.map((r) => {
              const inv = r.invoice_items.invoices;
              return (
                <tr key={r.id}>
                  <td>{fmtDate(inv.issue_date)}</td>
                  <td><Link href={`/facturacion/${inv.id}`} className="hover:text-primary-700">{inv.number}</Link></td>
                  <td>{inv.patients.last_name}, {inv.patients.first_name}<p className="text-xs text-slate-500">CI {inv.patients.document}</p></td>
                  <td>{inv.patient_insurances?.member_number}</td>
                  <td>{r.invoice_items.description} × {r.invoice_items.quantity}</td>
                  <td>{r.invoice_items.authorizations?.authorization_number ?? "—"}</td>
                  <td className="text-right tabular-nums">{gs(r.invoice_items.line_total)}</td>
                  <td className="text-right">{Number(r.invoice_items.coverage_percent)}%</td>
                  <td className="text-right tabular-nums">{gs(r.amount)}</td>
                  <td>{r.status === "rechazado" ? <><Badge tone="red">Rechazo {gs(r.rejected_amount)}</Badge><p className="text-xs text-slate-500">{r.rejection_reason}</p></> : r.status === "aprobado" ? <Badge tone="green">Aprobado</Badge> : <Badge>Incluido</Badge>}</td>
                  <td className="no-print text-right">{editable && s.status !== "borrador" && s.status !== "pagada" && (
                    <Modal trigger="Rechazo" title="Registrar rechazo / débito" size="sm" triggerVariant="ghost" triggerSize="sm">
                      <ActionForm action={rejectItem.bind(null, r.id)} className="space-y-4">
                        <p className="text-sm text-slate-600">{r.invoice_items.description} · reclamado {gs(r.amount)}. Ingresá 0 para aprobar sin débitos.</p>
                        <Field label="Importe rechazado (Gs.)" name="amount" required><Input name="amount" type="number" min={0} max={Number(r.amount)} defaultValue={Number(r.rejected_amount) || Number(r.amount)} required /></Field>
                        <Field label="Motivo" name="reason"><Input name="reason" defaultValue={r.rejection_reason ?? ""} /></Field>
                        <div className="flex justify-end"><SubmitButton variant="danger">Guardar</SubmitButton></div>
                      </ActionForm>
                    </Modal>
                  )}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>
      {!!pays?.length && (
        <Card title="Pagos recibidos" padded={false} className="mt-6">
          <table className="table-base"><thead><tr><th>Fecha</th><th>Referencia</th><th className="text-right">Importe</th></tr></thead>
            <tbody>{pays.map((p) => <tr key={p.id}><td>{fmtDate(p.paid_at)}</td><td>{p.reference ?? "—"}</td><td className="text-right tabular-nums">{gs(p.amount)}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
