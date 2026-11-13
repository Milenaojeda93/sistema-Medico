import { notFound } from "next/navigation";
import { CheckCircle2, FileText, Paperclip } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, Modal, PrintButton, SubmitButton } from "@/components/ui/client";
import { age, fmtDate, fmtDateTime } from "@/lib/utils";
import { AutoPrint } from "../../recetas/auto-print";
import { saveLabResult, voidLabOrder } from "../actions";
import { LAB_STATUS } from "../constants";
import { signedUrls, type LabOrderRow } from "../order-card";

export const metadata = { title: "Pedido de estudios" };

export default async function LabOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imprimir?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await guard("laboratorio");
  const { data: o } = await ctx.supabase.from("lab_orders")
    .select("*, patients(id, first_name, last_name, document, birth_date), doctors(full_name, license_number), lab_order_items(*)")
    .eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!o) notFound();
  const p = o.patients as { id: string; first_name: string; last_name: string; document: string; birth_date: string | null };
  const d = o.doctors as { full_name: string; license_number: string };
  const items = [...(o.lab_order_items as LabOrderRow["lab_order_items"])].sort((a, b) => a.position - b.position);
  const urls = await signedUrls(ctx, [o as unknown as LabOrderRow]);
  const editable = can(ctx.perms, "laboratorio", "edit") && o.status !== "anulado";
  const c = ctx.clinic;

  return (
    <>
      {sp.imprimir && <AutoPrint />}
      <div className="no-print">
        <PageHeader
          back={o.consultation_id && can(ctx.perms, "historias") ? { href: `/consultas/${o.consultation_id}#estudios`, label: "Volver a la consulta" } : { href: "/laboratorio", label: "Laboratorio" }}
          title={<span className="flex flex-wrap items-center gap-3">Pedido {o.number} <StatusBadge map={LAB_STATUS} value={o.status} />{o.priority === "urgente" && <Badge tone="red">Urgente</Badge>}</span>}
          description={`${p.first_name} ${p.last_name} · CI ${p.document} · Solicitado por ${d.full_name} el ${fmtDateTime(o.ordered_at, ctx.tz)}`}
          actions={<>
            <PrintButton label="Imprimir orden" />
            {editable && o.status !== "completado" && (
              <Modal trigger="Anular" title={`Anular pedido ${o.number}`} triggerVariant="ghost" size="sm">
                <ActionForm action={voidLabOrder.bind(null, id)} className="space-y-4">
                  <Field label="Motivo" name="reason" required><Input name="reason" required /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">Anular pedido</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
          </>}
        />
        {o.status === "anulado" && <div className="mb-4"><Notice tone="red"><b>Pedido anulado.</b> Motivo: {o.void_reason}</Notice></div>}
        {o.clinical_notes && <div className="mb-4"><Notice tone="blue"><b>Datos clínicos:</b> {o.clinical_notes}</Notice></div>}

        <div className="space-y-4">
          {items.map((i) => (
            <Card key={i.id} title={<span className="flex items-center gap-2">{i.status === "completado" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />}{i.study}</span>}
              actions={i.status === "completado" ? <Badge tone="green">Completado {i.result_at ? fmtDateTime(i.result_at, ctx.tz) : ""}</Badge> : <Badge tone="amber">Pendiente</Badge>}>
              {i.result_file_path && urls[i.result_file_path] && (
                <a href={urls[i.result_file_path]} target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 ring-1 ring-primary-100 hover:bg-primary-100">
                  {i.result_file_name?.toLowerCase().endsWith(".pdf") ? <FileText className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />} {i.result_file_name ?? "Archivo adjunto"}
                </a>
              )}
              {editable ? (
                <ActionForm action={saveLabResult.bind(null, i.id, id)} className="space-y-3">
                  <Field label="Resultado / informe" name="result">
                    <textarea name="result" rows={3} defaultValue={i.result ?? ""} className="input" placeholder="Ej.: Hemoglobina 13,5 g/dL (VR 12-16) · Leucocitos 7.200/mm³ …" />
                  </Field>
                  <Field label={i.result_file_path ? "Reemplazar archivo (PDF o imagen, máx. 10 MB)" : "Adjuntar archivo (PDF o imagen, máx. 10 MB)"} name="file">
                    <input type="file" name="file" accept="application/pdf,image/*" className="input py-1.5" />
                  </Field>
                  <div className="flex flex-wrap justify-end gap-2">
                    <SubmitButton variant="secondary" name="complete" value="0">Guardar borrador</SubmitButton>
                    <SubmitButton name="complete" value="1">{i.status === "completado" ? "Actualizar resultado" : "Marcar como completado"}</SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <p className="whitespace-pre-line text-sm text-slate-700">{i.result ?? (i.status === "completado" ? "Ver archivo adjunto" : "Resultado pendiente")}</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      <article className="hidden print:block">
        <header className="flex items-start justify-between gap-6 border-b-2 border-primary-600 pb-4">
          <div>
            <h1 className="text-xl font-semibold">{c.name}</h1>
            <p className="text-xs text-slate-500">{[c.address, c.city].filter(Boolean).join(", ")}{c.phone ? ` · Tel. ${c.phone}` : ""}</p>
          </div>
          <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Orden de estudios</p><p className="text-lg font-semibold">{o.number}</p><p className="text-xs">{fmtDate(o.ordered_at, ctx.tz)}</p></div>
        </header>
        <section className="grid grid-cols-2 gap-4 border-b border-slate-200 py-4 text-sm">
          <div><p className="text-[11px] font-semibold uppercase text-slate-400">Paciente</p><p className="font-medium">{p.first_name} {p.last_name}</p><p>CI {p.document}{p.birth_date ? ` · ${age(p.birth_date)} años` : ""}</p></div>
          <div><p className="text-[11px] font-semibold uppercase text-slate-400">Prioridad</p><p className="capitalize">{o.priority}</p>{o.clinical_notes && <p className="mt-1 text-slate-600">{o.clinical_notes}</p>}</div>
        </section>
        <section className="py-5">
          <p className="mb-3 text-sm font-semibold">Se solicita:</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">{items.map((i) => <li key={i.id}>{i.study}</li>)}</ol>
        </section>
        <footer className="mt-16 flex justify-end">
          <div className="w-64 text-center"><div className="mb-2 h-12 border-b border-slate-400" /><p className="text-sm font-semibold">{d.full_name}</p><p className="text-xs text-slate-500">Mat. {d.license_number}</p></div>
        </footer>
      </article>
    </>
  );
}
