"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, FileCheck2, Loader2, Pill, Plus, Printer, Trash2 } from "lucide-react";
import { btnClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createPrescription, type RxItem } from "./actions";

const ROUTES = ["Oral", "Sublingual", "Tópica", "Inhalatoria", "Nasal", "Oftálmica", "Ótica", "Intramuscular", "Intravenosa", "Subcutánea", "Rectal", "Vaginal"];
const FREQUENCIES = ["Cada 4 horas", "Cada 6 horas", "Cada 8 horas", "Cada 12 horas", "Una vez al día", "Dos veces al día", "Antes de dormir", "En ayunas", "Si hay dolor o fiebre"];
const DURATIONS = ["3 días", "5 días", "7 días", "10 días", "14 días", "30 días", "Uso continuo", "Hasta nuevo aviso"];
const EMPTY: RxItem = { drug: "", presentation: "", dose: "", frequency: "", duration: "", quantity: "", route: "Oral", instructions: "" };

export type PrevRx = { id: string; number: string; issued_at: string; items: RxItem[] };

export function PrescriptionBuilder({ patientId, doctorId, consultationId, defaultDiagnosis, allergies, suggestions, previous }: {
  patientId: string; doctorId: string; consultationId: string | null; defaultDiagnosis: string; allergies: string | null;
  suggestions: string[]; previous: PrevRx[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RxItem[]>([{ ...EMPTY }]);
  const [diagnosis, setDiagnosis] = useState(defaultDiagnosis);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (i: number, k: keyof RxItem, v: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const reset = () => { setItems([{ ...EMPTY }]); setNotes(""); setDiagnosis(defaultDiagnosis); setError(null); };
  const loadPrevious = (id: string) => {
    const p = previous.find((x) => x.id === id);
    if (p) setItems(p.items.map((x) => ({ ...EMPTY, ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v ?? ""])) })));
  };
  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createPrescription({ patientId, doctorId, consultationId, diagnosis, notes, items });
      if (res.error) { setError(res.error); return; }
      setDone(res.id ?? null);
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setOpen(true); setDone(null); }} className={btnClass("primary")}>
          <Pill className="h-4 w-4" /> Nueva receta
        </button>
        {done && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
            Receta emitida.
            <Link href={`/recetas/${done}?imprimir=1`} target="_blank" className="inline-flex items-center gap-1 font-semibold underline"><Printer className="h-3.5 w-3.5" /> Imprimir</Link>
          </span>
        )}
      </div>
    );
  }

  const valid = items.some((i) => i.drug.trim());

  return (
    <div className="space-y-4">
      {allergies && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-900 ring-1 ring-rose-200/70">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span><b>Alergias del paciente:</b> {allergies}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="label">Diagnóstico</span>
          <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Opcional" />
        </label>
        {previous.length > 0 && (
          <label>
            <span className="label">Repetir receta anterior</span>
            <select className="input" defaultValue="" onChange={(e) => { if (e.target.value) loadPrevious(e.target.value); e.target.value = ""; }}>
              <option value="">Elegir…</option>
              {previous.map((p) => <option key={p.id} value={p.id}>{p.number} · {new Date(p.issued_at).toLocaleDateString("es-PY")} · {p.items.map((i) => i.drug).join(", ").slice(0, 40)}</option>)}
            </select>
          </label>
        )}
      </div>

      <datalist id="rx-drugs">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="rx-freq">{FREQUENCIES.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="rx-dur">{DURATIONS.map((s) => <option key={s} value={s} />)}</datalist>

      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">{i + 1}</span>
              <input list="rx-drugs" className="input flex-1 font-medium" placeholder="Medicamento (nombre genérico o comercial)" value={it.drug} onChange={(e) => set(i, "drug", e.target.value)} autoFocus={i === items.length - 1 && i > 0} />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className={btnClass("ghost", "sm")} title="Quitar"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className="label">Presentación</span><input className="input" placeholder="Ej.: 500 mg comprimidos" value={it.presentation} onChange={(e) => set(i, "presentation", e.target.value)} /></label>
              <label><span className="label">Dosis</span><input className="input" placeholder="Ej.: 1 comprimido" value={it.dose} onChange={(e) => set(i, "dose", e.target.value)} /></label>
              <label><span className="label">Frecuencia</span><input list="rx-freq" className="input" placeholder="Ej.: Cada 8 horas" value={it.frequency} onChange={(e) => set(i, "frequency", e.target.value)} /></label>
              <label><span className="label">Duración</span><input list="rx-dur" className="input" placeholder="Ej.: 7 días" value={it.duration} onChange={(e) => set(i, "duration", e.target.value)} /></label>
              <label><span className="label">Vía</span>
                <select className="input" value={it.route} onChange={(e) => set(i, "route", e.target.value)}>{ROUTES.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              <label><span className="label">Cantidad a dispensar</span><input className="input" placeholder="Ej.: 1 caja x 21" value={it.quantity} onChange={(e) => set(i, "quantity", e.target.value)} /></label>
              <label className="sm:col-span-2"><span className="label">Indicaciones</span><input className="input" placeholder="Ej.: tomar después de las comidas" value={it.instructions} onChange={(e) => set(i, "instructions", e.target.value)} /></label>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => setItems((xs) => [...xs, { ...EMPTY }])} className={cn(btnClass("soft"), "w-full border border-dashed border-primary-200")}>
        <Plus className="h-4 w-4" /> Agregar otro medicamento
      </button>

      <label className="block">
        <span className="label">Indicaciones generales (opcional)</span>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: reposo 48 h, abundante líquido, volver a control en 7 días" />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <p className="mr-auto text-xs text-slate-500">Una vez emitida, la receta no se puede modificar (solo anular).</p>
        <button type="button" onClick={() => { setOpen(false); reset(); }} className={btnClass("ghost")}>Cancelar</button>
        <button type="button" onClick={submit} disabled={!valid || pending} className={btnClass("primary")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Emitir receta
        </button>
      </div>
    </div>
  );
}
