"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { Field, Input, Select, Textarea, btnClass } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { CATEGORIES } from "@/lib/constants";
import { cn, gs } from "@/lib/utils";
import { createInvoice, previewCoverage, type PreviewLine } from "./actions";

type Svc = { id: string; name: string; category: string; price: number; code: string | null };
type Ins = { id: string; patient_id: string; insurer_name: string; plan_name: string; member_number: string; effective_status: string };
type Line = { key: number; service_id: string; quantity: number; unit_price: number };

export function InvoiceForm({ patients, insurances, services, defaultPatient, consultationId, appointmentId, defaultInsurance, canEditPrice }: {
  patients: { id: string; name: string }[]; insurances: Ins[]; services: Svc[]; defaultPatient?: string; consultationId?: string; appointmentId?: string; defaultInsurance?: string; canEditPrice: boolean;
}) {
  const [pid, setPid] = useState(defaultPatient ?? "");
  const patIns = insurances.filter((i) => i.patient_id === pid);
  const [insId, setInsId] = useState<string>(defaultInsurance ?? "");
  const [lines, setLines] = useState<Line[]>([{ key: 1, service_id: "", quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [preview, setPreview] = useState<PreviewLine[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!patIns.some((i) => i.id === insId)) setInsId(patIns.find((i) => i.effective_status === "activo")?.id ?? "");
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = useMemo(() => lines.map(({ service_id, quantity, unit_price }) => ({ service_id, quantity, unit_price })), [lines]);
  useEffect(() => {
    const t = setTimeout(() => start(async () => {
      const r = await previewCoverage(insId || null, payload, { appointmentId: appointmentId ?? null, consultationId: consultationId ?? null });
      if (r.error) setErr(r.error); else { setErr(null); setPreview(r.lines ?? []); }
    }), 250);
    return () => clearTimeout(t);
  }, [insId, payload]);

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((a, l) => a + Math.round(l.unit_price * l.quantity), 0);
  const insurer = preview.reduce((a, p) => a + (p?.insurer_amount ?? 0), 0);
  const patient = preview.reduce((a, p) => a + (p?.patient_amount ?? 0), 0);
  const copay = preview.reduce((a, p) => a + (p?.copay ?? 0), 0);
  const selectedIns = patIns.find((i) => i.id === insId);

  return (
    <ActionForm action={createInvoice}>
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <input type="hidden" name="consultation_id" value={consultationId ?? ""} />
      <input type="hidden" name="appointment_id" value={appointmentId ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Paciente" name="patient_id" required>
          <Select name="patient_id" value={pid} onChange={(e) => setPid(e.target.value)} required>
            <option value="">Seleccioná…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Tipo de facturación" name="patient_insurance_id">
          <Select name="patient_insurance_id" value={insId} onChange={(e) => setInsId(e.target.value)}>
            <option value="">Particular (sin seguro)</option>
            {patIns.map((i) => <option key={i.id} value={i.id}>{i.insurer_name} — {i.plan_name} · {i.member_number}{i.effective_status !== "activo" ? ` (${i.effective_status})` : ""}</option>)}
          </Select>
        </Field>
      </div>
      {selectedIns && selectedIns.effective_status !== "activo" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" /> El seguro está {selectedIns.effective_status}: no se aplicará cobertura.</p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="table-base">
          <thead><tr><th className="min-w-56">Servicio</th><th className="w-20">Cant.</th><th className="w-36">Precio unit.</th><th className="text-right">Importe</th><th>Cobertura</th><th className="text-right">Aseguradora</th><th className="text-right">Paciente</th><th /></tr></thead>
          <tbody>
            {lines.map((l, idx) => {
              const p = preview[idx];
              return (
                <tr key={l.key}>
                  <td>
                    <select className="input" value={l.service_id} onChange={(e) => { const s = services.find((x) => x.id === e.target.value); set(l.key, { service_id: e.target.value, unit_price: s ? Number(s.price) : 0 }); }}>
                      <option value="">Seleccioná un servicio…</option>
                      {Object.entries(CATEGORIES).map(([cat, label]) => {
                        const opts = services.filter((s) => s.category === cat);
                        return opts.length ? <optgroup key={cat} label={label}>{opts.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ""}{s.name}</option>)}</optgroup> : null;
                      })}
                    </select>
                  </td>
                  <td><input className="input" type="number" min={1} value={l.quantity} onChange={(e) => set(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                  <td><input className="input" type="number" min={0} value={l.unit_price} disabled={!canEditPrice} onChange={(e) => set(l.key, { unit_price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                  <td className="text-right tabular-nums">{gs(l.unit_price * l.quantity)}</td>
                  <td className="text-xs">
                    {!l.service_id ? "—" : p ? (
                      <span className={cn("inline-flex items-center gap-1", p.covered ? "text-primary-700" : "text-slate-500")}>
                        {p.covered ? <ShieldCheck className="h-3.5 w-3.5" /> : p.requires_authorization ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : null}{p.note}
                      </span>
                    ) : "…"}
                  </td>
                  <td className="text-right tabular-nums">{p ? gs(p.insurer_amount) : "—"}</td>
                  <td className="text-right font-medium tabular-nums">{p ? gs(p.patient_amount) : "—"}</td>
                  <td>{lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-slate-100 p-3">
          <button type="button" className={btnClass("ghost", "sm")} onClick={() => setLines((ls) => [...ls, { key: Date.now(), service_id: "", quantity: 1, unit_price: 0 }])}><Plus className="h-4 w-4" /> Agregar servicio</button>
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Descuento al paciente (Gs.)" name="discount" hint="Se aplica sobre el importe a cargo del paciente">
            <Input name="discount" type="number" min={0} max={patient} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Observaciones" name="notes"><Textarea name="notes" rows={2} /></Field>
        </div>
        <div className="rounded-xl bg-slate-50 p-5">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">Resumen {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}</div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Importe total</dt><dd className="tabular-nums">{gs(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Cubierto por la aseguradora</dt><dd className="tabular-nums text-primary-700">{gs(insurer)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Copago incluido</dt><dd className="tabular-nums">{gs(copay)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Correspondiente al paciente</dt><dd className="tabular-nums">{gs(patient)}</dd></div>
            {discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd className="tabular-nums text-green-700">− {gs(discount)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>A cobrar al paciente</dt><dd className="tabular-nums">{gs(Math.max(0, patient - discount))}</dd></div>
            <div className="flex justify-between text-sm"><dt className="text-slate-600">Cuenta por cobrar a la aseguradora</dt><dd className="font-semibold tabular-nums text-primary-700">{gs(insurer)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">El cálculo final lo realiza el servidor al emitir, verificando plan, vigencia, límites y autorizaciones.</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end"><SubmitButton>Emitir factura</SubmitButton></div>
    </ActionForm>
  );
}
