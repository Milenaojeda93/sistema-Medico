"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Building2, Check, FlaskConical, Loader2, MapPin, Plus, Printer, Send, X } from "lucide-react";
import { btnClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createLabOrder, type LabItem } from "./actions";
import { STUDY_GROUPS } from "./constants";

export function LabOrderBuilder({ patientId, doctorId, consultationId }: { patientId: string; doctorId: string; consultationId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LabItem[]>([]);
  const [custom, setCustom] = useState("");
  const [customCat, setCustomCat] = useState<LabItem["category"]>("laboratorio");
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [location, setLocationState] = useState<"interno" | "externo">("interno");
  const [externalLab, setExternalLab] = useState("");
  const [doneExt, setDoneExt] = useState(false);
  // Recordamos la última elección del médico (si su clínica no tiene laboratorio, no lo elige cada vez).
  useEffect(() => { try { const v = localStorage.getItem("medvia.lab.location"); if (v === "externo" || v === "interno") setLocationState(v); } catch {} }, []);
  const setLocation = (v: "interno" | "externo") => { setLocationState(v); try { localStorage.setItem("medvia.lab.location", v); } catch {} };

  const has = (s: string) => items.some((i) => i.study.toLowerCase() === s.toLowerCase());
  const toggle = (study: string, category: LabItem["category"]) =>
    setItems((xs) => (has(study) ? xs.filter((x) => x.study.toLowerCase() !== study.toLowerCase()) : [...xs, { study, category }]));
  const addCustom = () => {
    const s = custom.trim();
    if (s && !has(s)) setItems((xs) => [...xs, { study: s, category: customCat }]);
    setCustom("");
  };
  const reset = () => { setItems([]); setNotes(""); setPriority("normal"); setError(null); setCustom(""); };
  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createLabOrder({ patientId, doctorId, consultationId, priority, notes, items, location, externalLab });
      if (res.error) { setError(res.error); return; }
      setDone(res.id ?? null); setDoneExt(location === "externo"); setOpen(false); reset(); router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setOpen(true); setDone(null); }} className={btnClass("primary")}><FlaskConical className="h-4 w-4" /> Pedir estudios</button>
        {done && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
            {doneExt ? "Orden lista para entregar al paciente." : "Pedido enviado al laboratorio de la clínica."}
            <Link href={`/laboratorio/${done}?imprimir=1`} target="_blank" className="inline-flex items-center gap-1 font-semibold underline"><Printer className="h-3.5 w-3.5" /> Imprimir orden</Link>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label">¿Dónde se hace el estudio?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { v: "interno", icon: <Building2 className="h-5 w-5" />, t: "En el laboratorio de la clínica", d: "Le llega al laboratorio, que carga los resultados." },
            { v: "externo", icon: <MapPin className="h-5 w-5" />, t: "Afuera, en otro laboratorio", d: "Se imprime la orden. Cuando el paciente vuelve, adjuntás los resultados." },
          ] as const).map((o) => (
            <button type="button" key={o.v} onClick={() => setLocation(o.v)}
              className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition",
                location === o.v ? "border-primary-500 bg-primary-50/60 ring-1 ring-primary-500" : "border-slate-200 bg-white hover:border-primary-300")}>
              <span className={cn("mt-0.5", location === o.v ? "text-primary-600" : "text-slate-400")}>{o.icon}</span>
              <span><span className="block text-sm font-semibold text-slate-800">{o.t}</span><span className="block text-xs text-slate-500">{o.d}</span></span>
            </button>
          ))}
        </div>
        {location === "externo" && (
          <input className="input mt-2" value={externalLab} onChange={(e) => setExternalLab(e.target.value)} placeholder="Laboratorio sugerido (opcional). Ej.: Laboratorio Díaz Gill" />
        )}
      </div>
      {STUDY_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="label">{g.label}</p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((s) => {
              const on = has(s);
              return (
                <button type="button" key={s} onClick={() => toggle(s, g.category)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                    on ? "border-primary-500 bg-primary-600 text-white shadow-soft" : "border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50")}>
                  {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-slate-400" />} {s}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="label">Otro estudio</p>
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" placeholder="Escribí el nombre del estudio y presioná Enter" value={custom}
            onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <select className="input w-auto" value={customCat} onChange={(e) => setCustomCat(e.target.value as LabItem["category"])}>
            <option value="laboratorio">Laboratorio</option><option value="imagen">Imagen</option><option value="otro">Otro</option>
          </select>
          <button type="button" onClick={addCustom} className={btnClass("secondary")}>Agregar</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-800">Pedido ({items.length})</p>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <span key={i.study} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] text-slate-800 ring-1 ring-primary-200">
                {i.study}
                <button type="button" onClick={() => toggle(i.study, i.category)} className="text-slate-400 hover:text-rose-600" aria-label={`Quitar ${i.study}`}><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="label">Prioridad</p>
          <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200/60">
            {(["normal", "urgente"] as const).map((p) => (
              <button type="button" key={p} onClick={() => setPriority(p)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium capitalize", priority === p ? (p === "urgente" ? "bg-rose-600 text-white" : "bg-white text-slate-900 shadow-soft") : "text-slate-500")}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <label><span className="label">Datos clínicos / indicaciones (opcional)</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: paciente en ayunas, sospecha de anemia" />
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => { setOpen(false); reset(); }} className={btnClass("ghost")}>Cancelar</button>
        <button type="button" onClick={submit} disabled={!items.length || pending} className={btnClass("primary")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {location === "externo" ? "Generar orden" : "Enviar al laboratorio"}{items.length ? ` (${items.length})` : ""}
        </button>
      </div>
    </div>
  );
}
