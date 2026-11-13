import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESETS, rangeQuery, type Range } from "./range";

export function RangePicker({ r, base, keep = {} }: { r: Range; base: string; keep?: Record<string, string | undefined> }) {
  return (
    <div className="card mb-6 flex flex-wrap items-center gap-3 p-3">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-inset ring-slate-200/60">
        {Object.entries(PRESETS).map(([k, v]) => (
          <Link key={k} href={`${base}?${rangeQuery({ ...r, preset: k as Range["preset"] }, keep)}`}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", r.preset === k ? "bg-white text-slate-900 shadow-soft ring-1 ring-slate-200/70" : "text-slate-500 hover:text-slate-800")}>
            {v}
          </Link>
        ))}
      </div>
      <form action={base} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="periodo" value="personalizado" />
        {Object.entries(keep).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="sr-only" htmlFor="desde">Desde</label>
        <input id="desde" type="date" name="desde" defaultValue={r.desde} className="input h-9 w-auto py-1" />
        <span className="text-sm text-slate-400">al</span>
        <label className="sr-only" htmlFor="hasta">Hasta</label>
        <input id="hasta" type="date" name="hasta" defaultValue={r.hasta} className="input h-9 w-auto py-1" />
        <button className={cn("inline-flex h-9 items-center rounded-[10px] px-3.5 text-sm font-medium", r.preset === "personalizado" ? "bg-primary-600 text-white" : "bg-white text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>Aplicar</button>
      </form>
      <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-600"><CalendarDays className="h-4 w-4 text-primary-600" /> {r.label}</span>
    </div>
  );
}
