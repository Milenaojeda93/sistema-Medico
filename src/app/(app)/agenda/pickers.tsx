"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { cn, gs } from "@/lib/utils";
import { SearchSelect } from "@/components/ui/pickers";

export type Pat = { id: string; name: string; document: string; phone?: string | null };
export type Doc = { id: string; full_name: string; specialties: string[]; fee: number | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");
/** 3154932 → 3.154.932 (formato habitual de cédula en Paraguay) */
export const fmtCI = (d: string) => (/^\d+$/.test(d) ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d);
const initials = (name: string) => {
  const [last = "", first = ""] = name.split(",").map((x) => x.trim());
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
};
const docInitials = (n: string) => n.replace(/^(dra?\.?|lic\.?)\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const TONES = ["bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-primary-100 text-primary-700"];
const tone = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

function Avatar({ id, text, size = "md" }: { id: string; text: string; size?: "md" | "lg" }) {
  return <span className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", tone(id), size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs")}>{text}</span>;
}

export function PatientPicker({ patients, value, onChange }: { patients: Pat[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const selected = patients.find((p) => p.id === value);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    const d = digits(t);
    if (d && d.length === t.replace(/[\s.\-]/g, "").length) {
      // Búsqueda por cédula: primero los que empiezan con esos números.
      const hits = patients.filter((p) => digits(p.document).includes(d));
      const starts = (p: Pat) => (digits(p.document).startsWith(d) ? 1 : 0);
      return hits.sort((a, b) => starts(b) - starts(a)).slice(0, 8);
    }
    const words = norm(t).split(/\s+/).filter(Boolean);
    return patients.filter((p) => { const n = norm(p.name); return words.every((w) => n.includes(w)); }).slice(0, 8);
  }, [q, patients]);

  const pick = (id: string) => { onChange(id); setQ(""); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[active]) pick(results[active].id); }
  };

  return (
    <div>
      <input name="patient_id" value={value} required onChange={() => {}} tabIndex={-1} aria-hidden="true" className="sr-only" onInvalid={() => input.current?.focus()} />
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50/40 px-4 py-3">
          <Avatar id={selected.id} text={initials(selected.name)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{selected.name}</p>
            <p className="text-xs text-slate-500">
              <span className="font-medium tabular-nums text-slate-700">CI {fmtCI(selected.document)}</span>
              {selected.phone && <> · {selected.phone}</>}
            </p>
          </div>
          <button type="button" onClick={() => { onChange(""); setTimeout(() => input.current?.focus(), 0); }} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-white">Cambiar</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10">
          <div className="flex items-center gap-2 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input ref={input} value={q} autoComplete="off" placeholder="Buscá por nombre o número de cédula…"
              onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            {q && <button type="button" aria-label="Limpiar" onClick={() => setQ("")} className="rounded p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
          </div>
          {q.trim() && (
            <div className="border-t border-slate-100">
              {results.length > 0 && (
                <div className="grid grid-cols-[1fr_auto] bg-slate-50/70 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Paciente</span><span>Cédula</span>
                </div>
              )}
              <ul className="max-h-64 overflow-auto p-1">
                {results.map((p, i) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pick(p.id)} onMouseEnter={() => setActive(i)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === active ? "bg-primary-50" : "hover:bg-slate-50")}>
                      <Avatar id={p.id} text={initials(p.name)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                        {p.phone && <span className="block truncate text-xs text-slate-500">{p.phone}</span>}
                      </span>
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs tabular-nums text-slate-700">{fmtCI(p.document)}</span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-slate-500">
                    No encontramos «{q.trim()}».{" "}
                    <Link href="/pacientes/nuevo" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"><UserPlus className="h-3.5 w-3.5" /> Registrar paciente</Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      {!selected && !q.trim() && (
        <p className="mt-1.5 text-xs text-slate-400">Escribí el apellido o la cédula. ¿Es nuevo? <Link href="/pacientes/nuevo" className="text-primary-600 hover:underline">Registrar paciente</Link></p>
      )}
    </div>
  );
}

export function SpecialtyChips({ specialties, value, onChange }: { specialties: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  if (specialties.length > 10) {
    return <SearchSelect name="specialty_id" value={value} onChange={onChange} placeholder="Todas las especialidades · buscá una…" options={specialties.map((s) => ({ value: s.id, label: s.name }))} />;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name="specialty_id" value={value} />
      {[{ id: "", name: "Todas" }, ...specialties].map((s) => (
        <button type="button" key={s.id || "all"} onClick={() => onChange(s.id)}
          className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
            value === s.id ? "border-primary-600 bg-primary-600 text-white shadow-soft" : "border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700")}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

const CARD_LIMIT = 6; // hasta este número se muestran tarjetas; con más, buscador + lista compacta

export function DoctorCards({ doctors, specialties, value, onChange, priceFor }: {
  doctors: Doc[]; specialties: { id: string; name: string }[]; value: string; onChange: (id: string) => void; priceFor: (d: Doc) => number | null;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [changing, setChanging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const name = (id: string) => specialties.find((s) => s.id === id)?.name;
  const specs = (d: Doc) => d.specialties.map(name).filter(Boolean).join(" · ");
  const words = norm(q.trim()).split(/\s+/).filter(Boolean);
  const list = words.length ? doctors.filter((d) => { const t = norm(`${d.full_name} ${specs(d)}`); return words.every((w) => t.includes(w)); }) : doctors;
  const many = doctors.length > CARD_LIMIT;
  const selected = doctors.find((d) => d.id === value);
  const pick = (id: string) => { onChange(id); setQ(""); setChanging(false); setActive(0); };

  const Price = ({ d, compact }: { d: Doc; compact?: boolean }) => {
    const price = priceFor(d);
    if (price == null) return <span className="shrink-0 text-[11px] text-slate-400">Sin costo</span>;
    return compact
      ? <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">{gs(price)}</span>
      : <span className="shrink-0 text-right"><span className="block text-[10px] uppercase tracking-wide text-slate-400">Particular</span><span className="block text-sm font-semibold tabular-nums text-slate-800">{gs(price)}</span></span>;
  };

  const hidden = <input name="doctor_id" value={value} required onChange={() => {}} tabIndex={-1} aria-hidden="true" className="sr-only" onInvalid={() => { setChanging(true); input.current?.focus(); }} />;
  if (doctors.length === 0) return <div>{hidden}<p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">No hay médicos con esta especialidad.</p></div>;

  // Muchos médicos y uno ya elegido: se muestra solo el elegido.
  if (many && selected && !changing) {
    return (
      <div>
        {hidden}
        <div className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50/40 px-4 py-3">
          <Avatar id={selected.id} text={docInitials(selected.full_name)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-slate-900">{selected.full_name}</p>
            <p className="truncate text-xs text-slate-500">{specs(selected) || "Sin especialidad"}</p>
          </div>
          <Price d={selected} />
          <button type="button" onClick={() => { setChanging(true); setTimeout(() => input.current?.focus(), 0); }} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-white">Cambiar</button>
        </div>
      </div>
    );
  }

  const search = (
    <div className="relative mb-2">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input ref={input} value={q} autoComplete="off" placeholder="Buscá el profesional por nombre o especialidad…"
        onChange={(e) => { setQ(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); const d = many ? list[active] : list.length === 1 ? list[0] : null; if (d) pick(d.id); }
          else if (e.key === "Escape" && selected) setChanging(false);
        }}
        className="input h-10 pl-9 pr-9 text-sm" />
      {q && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
    </div>
  );
  const empty = list.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Ningún profesional coincide con «{q.trim()}».</p>;

  if (many) {
    const shown = list.slice(0, 50);
    return (
      <div>
        {hidden}
        {search}
        {empty}
        {list.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ul className="max-h-[264px] divide-y divide-slate-100 overflow-auto">
              {shown.map((d, i) => (
                <li key={d.id}>
                  <button type="button" onClick={() => pick(d.id)} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === active ? "bg-primary-50" : "hover:bg-slate-50", d.id === value && "bg-primary-50/60")}>
                    <Avatar id={d.id} text={docInitials(d.full_name)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{d.full_name}</span>
                      <span className="block truncate text-xs text-slate-500">{specs(d) || "Sin especialidad"}</span>
                    </span>
                    <Price d={d} compact />
                    {d.id === value && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
              {list.length > shown.length ? `Mostrando ${shown.length} de ${list.length}. Escribí para afinar la búsqueda.` : `${list.length} profesional${list.length === 1 ? "" : "es"}`}
              {selected && <> · <button type="button" onClick={() => setChanging(false)} className="font-medium text-primary-600 hover:underline">Mantener {selected.full_name}</button></>}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Pocos médicos: tarjetas.
  const cards = value && !list.some((d) => d.id === value) ? [...doctors.filter((d) => d.id === value), ...list] : list;
  return (
    <div>
      {hidden}
      {doctors.length > 1 && search}
      {empty}
      <div className="grid gap-2 p-0.5 sm:grid-cols-2">
        {cards.map((d) => {
          const on = d.id === value;
          return (
            <button type="button" key={d.id} onClick={() => pick(d.id)}
              className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                on ? "border-primary-500 bg-primary-50/60 ring-1 ring-primary-500" : "border-slate-200 bg-white hover:border-primary-300")}>
              <Avatar id={d.id} text={docInitials(d.full_name)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-slate-800">{d.full_name}</span>
                <span className="block truncate text-xs text-slate-500" title={specs(d)}>{specs(d) || "Sin especialidad"}</span>
              </span>
              <Price d={d} />
              {on && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
