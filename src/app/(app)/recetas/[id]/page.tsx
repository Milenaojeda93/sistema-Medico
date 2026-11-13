import Link from "next/link";
import { notFound } from "next/navigation";
import { guard, can } from "@/lib/context";
import { Badge, Field, Input, Notice, PageHeader } from "@/components/ui";
import { ActionForm, Modal, PrintButton, SubmitButton } from "@/components/ui/client";
import { age, fmtDate, fmtDateTime } from "@/lib/utils";
import { voidPrescription } from "../actions";
import { AutoPrint } from "../auto-print";

export const metadata = { title: "Receta médica" };

type Item = { drug: string; presentation: string | null; dose: string | null; frequency: string | null; duration: string | null; quantity: string | null; route: string | null; instructions: string | null; position: number };

export default async function PrescriptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imprimir?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await guard("recetas");
  const { data: r } = await ctx.supabase.from("prescriptions")
    .select("*, patients(id, first_name, last_name, document, birth_date), doctors(full_name, license_number), consultations(id, specialties(name)), prescription_items(*)")
    .eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!r) notFound();
  const p = r.patients as { id: string; first_name: string; last_name: string; document: string; birth_date: string | null };
  const d = r.doctors as { full_name: string; license_number: string };
  const spec = (r.consultations as { id: string; specialties: { name: string } | null } | null);
  const items = [...(r.prescription_items as Item[])].sort((a, b) => a.position - b.position);
  const c = ctx.clinic as { name: string; ruc?: string | null; address?: string | null; phone?: string | null; email?: string | null; city?: string | null };
  const voided = r.status === "anulada";

  return (
    <>
      {sp.imprimir && !voided && <AutoPrint />}
      <div className="no-print">
        <PageHeader
          back={spec ? { href: `/consultas/${spec.id}#receta`, label: "Volver a la consulta" } : { href: "/recetas", label: "Recetas" }}
          title={<span className="flex items-center gap-3">Receta {r.number} {voided ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Emitida</Badge>}</span>}
          description={`${p.first_name} ${p.last_name} · ${fmtDateTime(r.issued_at, ctx.tz)}`}
          actions={<>
            {!voided && <PrintButton label="Imprimir receta" />}
            {!voided && can(ctx.perms, "recetas", "edit") && (
              <Modal trigger="Anular" title={`Anular receta ${r.number}`} triggerVariant="ghost" size="sm">
                <ActionForm action={voidPrescription.bind(null, id)} className="space-y-4">
                  <Field label="Motivo de la anulación" name="reason" required><Input name="reason" required placeholder="Ej.: error en la dosis" /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">Anular receta</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
          </>}
        />
        {voided && <div className="mb-4"><Notice tone="red"><b>Receta anulada.</b> Motivo: {r.void_reason}</Notice></div>}
      </div>

      <article className="mx-auto max-w-[760px] rounded-2xl border border-slate-200 bg-white p-10 shadow-soft print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-primary-600 pb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">{c.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {[c.address, c.city].filter(Boolean).join(", ")}{c.phone ? ` · Tel. ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}{c.ruc ? <><br />RUC {c.ruc}</> : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Receta médica</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{r.number}</p>
            <p className="text-xs text-slate-500">{fmtDate(r.issued_at, ctx.tz)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 border-b border-slate-100 py-4 text-sm">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Paciente</p><p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p><p className="text-slate-600">CI {p.document}{p.birth_date ? ` · ${age(p.birth_date)} años` : ""}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Diagnóstico</p><p className="text-slate-800">{r.diagnosis ?? "—"}</p></div>
        </section>

        <section className="py-6">
          <p className="mb-4 font-serif text-3xl italic text-primary-700">Rp/</p>
          <ol className="space-y-5">
            {items.map((i, n) => (
              <li key={n} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 print:border print:border-slate-300 print:bg-white">{n + 1}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-950">{i.drug}{i.presentation ? <span className="font-normal text-slate-700"> — {i.presentation}</span> : null}{i.quantity ? <span className="font-normal text-slate-500"> · Cant.: {i.quantity}</span> : null}</p>
                  <p className="text-sm text-slate-700">{[i.dose, i.route ? `vía ${i.route.toLowerCase()}` : null, i.frequency?.toLowerCase(), i.duration ? `durante ${i.duration.toLowerCase()}` : null].filter(Boolean).join(", ")}</p>
                  {i.instructions && <p className="text-sm italic text-slate-500">{i.instructions}</p>}
                </div>
              </li>
            ))}
          </ol>
          {r.notes && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 print:border print:border-slate-200 print:bg-white">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Indicaciones</p>
              <p className="whitespace-pre-line">{r.notes}</p>
            </div>
          )}
        </section>

        <footer className="mt-10 flex items-end justify-between gap-6 pt-6">
          <p className="text-[11px] text-slate-400">Emitida el {fmtDateTime(r.issued_at, ctx.tz)} · {r.number}</p>
          <div className="w-64 text-center">
            <div className="mb-2 h-14 border-b border-slate-400" />
            <p className="text-sm font-semibold text-slate-900">{d.full_name}</p>
            <p className="text-xs text-slate-500">{spec?.specialties?.name ? `${spec.specialties.name} · ` : ""}Mat. {d.license_number}</p>
          </div>
        </footer>
        {voided && <p className="mt-6 text-center text-2xl font-bold uppercase tracking-widest text-rose-500">Anulada</p>}
      </article>
      <p className="no-print mt-4 text-center text-xs text-slate-400"><Link href={`/pacientes/${p.id}?tab=recetas`} className="hover:text-primary-700">Ver todas las recetas del paciente</Link></p>
    </>
  );
}
