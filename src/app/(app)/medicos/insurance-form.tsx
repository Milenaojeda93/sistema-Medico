"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ActionForm, SubmitButton, type FormAction } from "@/components/ui/client";
import { cn } from "@/lib/utils";

type Insurer = { id: string; trade_name: string };
type Plan = { id: string; insurer_id: string; name: string };
export type DocIns = { insurer_id: string; plan_id: string | null; coverage_percent: number | null; copay: number | null };

type PlanState = { on: boolean; pct: string; copay: string };
type Row = { on: boolean; pct: string; copay: string; byPlan: boolean; plans: Record<string, PlanState> };

const s = (n: number | null | undefined) => (n == null ? "" : String(Number(n)));

/** Lista de aseguradoras con tilde: el médico atiende las tildadas, con % y copago opcionales (y, si hace falta, distintos por plan). */
export function DoctorInsurancesEditor({ insurers, plans, initial, action, editable }: {
  insurers: Insurer[]; plans: Plan[]; initial: DocIns[]; action: FormAction; editable: boolean;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const out: Record<string, Row> = {};
    for (const i of insurers) {
      const mine = initial.filter((x) => x.insurer_id === i.id);
      const general = mine.find((x) => !x.plan_id);
      const planRows = mine.filter((x) => x.plan_id);
      const ps: Record<string, PlanState> = {};
      for (const p of plans.filter((p) => p.insurer_id === i.id)) {
        const r = planRows.find((x) => x.plan_id === p.id);
        ps[p.id] = { on: planRows.length ? !!r : true, pct: s(r?.coverage_percent), copay: r && Number(r.copay) ? s(r.copay) : "" };
      }
      out[i.id] = { on: mine.length > 0, pct: s(general?.coverage_percent), copay: general && Number(general.copay) ? s(general.copay) : "", byPlan: planRows.length > 0, plans: ps };
    }
    return out;
  });
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setPlan = (id: string, pid: string, patch: Partial<PlanState>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], plans: { ...r[id].plans, [pid]: { ...r[id].plans[pid], ...patch } } } }));
  const checked = useMemo(() => insurers.filter((i) => rows[i.id]?.on).length, [rows, insurers]);

  type Out = { insurer_id: string; plan_id: string | null; coverage_percent: string; copay: string };
  const payload = JSON.stringify(insurers.filter((i) => rows[i.id].on).flatMap((i): Out[] => {
    const r = rows[i.id];
    if (!r.byPlan) return [{ insurer_id: i.id, plan_id: null, coverage_percent: r.pct, copay: r.copay }];
    return Object.entries(r.plans).filter(([, p]) => p.on).map(([pid, p]) => ({ insurer_id: i.id, plan_id: pid, coverage_percent: p.pct || r.pct, copay: p.copay || r.copay }));
  }));

  if (!insurers.length) return <p className="text-sm text-slate-500">No hay aseguradoras cargadas. Creálas primero en <b>Aseguradoras</b>.</p>;

  return (
    <ActionForm action={action}>
      <input type="hidden" name="rows" value={payload} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {checked === 0
            ? <><b className="text-slate-800">Atiende todos los seguros</b> con la cobertura de cada plan. Tildá solo los que atiende si querés limitarlo.</>
            : <>Atiende <b className="text-slate-800">{checked} {checked === 1 ? "aseguradora" : "aseguradoras"}</b>. Las no tildadas: el paciente abona como particular.</>}
        </p>
        {editable && (
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, on: true }])))} className="font-medium text-primary-600 hover:underline">Tildar todas</button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={() => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, on: false }])))} className="font-medium text-slate-500 hover:underline">Ninguna</button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[1fr_150px_170px] gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
          <span>Aseguradora</span><span>% que cubre</span><span>Copago del paciente</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {insurers.map((i) => {
            const r = rows[i.id];
            const own = plans.filter((p) => p.insurer_id === i.id);
            return (
              <li key={i.id} className={cn(r.on ? "bg-white" : "bg-slate-50/40")}>
                <div className="grid items-center gap-3 px-4 py-2.5 sm:grid-cols-[1fr_150px_170px]">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={r.on} disabled={!editable} onChange={(e) => set(i.id, { on: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
                    <span className={cn("text-sm font-medium", r.on ? "text-slate-900" : "text-slate-500")}>{i.trade_name}</span>
                    {r.on && own.length > 0 && (
                      <button type="button" onClick={(e) => { e.preventDefault(); set(i.id, { byPlan: !r.byPlan }); }} className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary-600 hover:underline">
                        {r.byPlan ? "Igual para todos los planes" : "Distinto por plan"} <ChevronDown className={cn("h-3 w-3 transition", r.byPlan && "rotate-180")} />
                      </button>
                    )}
                  </label>
                  <PctInput value={r.pct} disabled={!r.on || !editable} onChange={(v) => set(i.id, { pct: v })} placeholder={r.byPlan ? "Por defecto" : "Según el plan"} />
                  <GsInput value={r.copay} disabled={!r.on || !editable} onChange={(v) => set(i.id, { copay: v })} />
                </div>
                {r.on && r.byPlan && (
                  <ul className="mb-2 ml-11 mr-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/60">
                    {own.map((p) => {
                      const ps = r.plans[p.id];
                      return (
                        <li key={p.id} className="grid items-center gap-3 px-3 py-2 sm:grid-cols-[1fr_150px_170px]">
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" checked={ps.on} disabled={!editable} onChange={(e) => setPlan(i.id, p.id, { on: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                            <span className={ps.on ? "text-slate-700" : "text-slate-400 line-through"}>Plan {p.name}</span>
                          </label>
                          <PctInput value={ps.pct} disabled={!ps.on || !editable} onChange={(v) => setPlan(i.id, p.id, { pct: v })} placeholder={r.pct ? `${r.pct}%` : "Según el plan"} />
                          <GsInput value={ps.copay} disabled={!ps.on || !editable} onChange={(v) => setPlan(i.id, p.id, { copay: v })} placeholder={r.copay ? r.copay : "—"} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 text-xs text-slate-500">% vacío = vale la cobertura configurada en el plan de la aseguradora. Se aplica a las consultas con este profesional, al agendar y al facturar.</p>
      {editable && <div className="mt-4 flex justify-end"><SubmitButton>Guardar seguros</SubmitButton></div>}
    </ActionForm>
  );
}

function PctInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <input type="number" min={0} max={100} step={1} inputMode="numeric" value={value} disabled={disabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className="input h-9 pr-7 text-sm" />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
    </div>
  );
}

function GsInput({ value, onChange, disabled, placeholder = "—" }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Gs</span>
      <input type="number" min={0} step={1000} inputMode="numeric" value={value} disabled={disabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className="input h-9 pl-9 text-sm" />
    </div>
  );
}
