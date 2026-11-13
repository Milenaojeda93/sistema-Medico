"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; hint?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

/** Lista desplegable con buscador. Envía el valor elegido con `name` dentro del formulario. */
export function SearchSelect({
  name, options, value: controlled, defaultValue = "", onChange, required, placeholder = "Buscá o seleccioná…", emptyText = "Sin resultados", clearable = true, limit = 60,
}: {
  name: string; options: Option[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; required?: boolean; placeholder?: string; emptyText?: string; clearable?: boolean; limit?: number;
}) {
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const close = useMemo(() => () => { setOpen(false); setQ(""); }, []);
  useOutside(box, close);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const list = words.length ? options.filter((o) => { const t = norm(`${o.label} ${o.hint ?? ""}`); return words.every((w) => t.includes(w)); }) : options;
    return list.slice(0, limit);
  }, [q, options, limit]);
  const total = q ? options.filter((o) => norm(`${o.label} ${o.hint ?? ""}`).includes(norm(q))).length : options.length;

  const pick = (v: string) => { if (controlled === undefined) setInner(v); onChange?.(v); close(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { if (open && filtered[active]) { e.preventDefault(); pick(filtered[active].value); } }
    else if (e.key === "Escape") close();
  };

  return (
    <div ref={box} className="relative">
      {/* Campo real que viaja en el formulario (y valida "obligatorio"). */}
      <input name={name} value={value} required={required} onChange={() => {}} tabIndex={-1} aria-hidden="true"
        onInvalid={() => input.current?.focus()} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
      <div className={cn("input flex items-center gap-2 pr-2", open && "border-primary-500 ring-4 ring-primary-500/10")}>
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={input} id={name} role="combobox" aria-expanded={open} aria-controls={listId} autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder={selected ? "" : placeholder}
          value={open ? q : selected ? selected.label : ""}
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKey}
        />
        {open && selected && !q && <span className="truncate text-xs text-slate-400">{selected.label}</span>}
        {clearable && value && !open
          ? <button type="button" aria-label="Quitar selección" onClick={() => pick("")} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
          : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }} onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm", i === active ? "bg-primary-50 text-primary-800" : "text-slate-700")}>
              <span className="min-w-0 flex-1"><span className="block truncate">{o.label}</span>{o.hint && <span className="block truncate text-xs text-slate-500">{o.hint}</span>}</span>
              {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
            </li>
          ))}
          {total > filtered.length && <li className="px-3 py-1.5 text-xs text-slate-400">Mostrando {filtered.length} de {total}. Escribí para afinar la búsqueda.</li>}
        </ul>
      )}
    </div>
  );
}

const splitTags = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

/** Selección múltiple con sugerencias + texto libre. Se guarda como "A, B, C" (compatible con los datos actuales). */
export function TagInput({ name, defaultValue = "", suggestions, placeholder = "Escribí o elegí de la lista…", none }: {
  name: string; defaultValue?: string; suggestions: string[]; placeholder?: string; none?: string;
}) {
  const [tags, setTags] = useState<string[]>(() => splitTags(defaultValue));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useMemo(() => () => setOpen(false), []);
  useOutside(box, close);

  const has = (t: string) => tags.some((x) => norm(x) === norm(t));
  const filtered = useMemo(() => {
    const n = norm(q.trim());
    return suggestions.filter((s) => !has(s) && (!n || norm(s).includes(n))).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, suggestions, tags]);
  const exact = q.trim() && (suggestions.some((s) => norm(s) === norm(q.trim())) || has(q.trim()));
  const items = [...filtered.map((t) => ({ custom: false, text: t })), ...(q.trim() && !exact ? [{ custom: true, text: q.trim() }] : [])];

  const add = (t: string) => {
    const v = t.trim();
    if (!v || has(v)) { setQ(""); return; }
    // "Ninguna conocida" excluye al resto, y viceversa.
    setTags((prev) => (none && norm(v) === norm(none) ? [v] : [...prev.filter((x) => !none || norm(x) !== norm(none)), v]));
    setQ(""); setActive(0); input.current?.focus();
  };
  const remove = (t: string) => setTags((prev) => prev.filter((x) => x !== t));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (open && items[active]) add(items[active].text); else add(q); }
    else if (e.key === "Backspace" && !q && tags.length) remove(tags[tags.length - 1]);
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={tags.join(", ")} />
      <div onClick={() => input.current?.focus()}
        className={cn("input flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 py-1.5", open && "border-primary-500 ring-4 ring-primary-500/10")}>
        {tags.map((t) => (
          <span key={t} className={cn("inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1 text-xs font-medium ring-1",
            none && norm(t) === norm(none) ? "bg-slate-50 text-slate-600 ring-slate-200" : "bg-primary-50 text-primary-800 ring-primary-100")}>
            {t}
            <button type="button" aria-label={`Quitar ${t}`} onClick={(e) => { e.stopPropagation(); remove(t); }} className="rounded p-0.5 hover:bg-white/80"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input ref={input} id={name} autoComplete="off" value={q} placeholder={tags.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-400"
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKey} onBlur={() => { if (q.trim() && filtered.length === 0) add(q); else setQ(""); }} />
      </div>
      {open && items.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop">
          {items.map((it, i) => (
            <li key={(it.custom ? "+" : "") + it.text} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); add(it.text); }} onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm", i === active ? "bg-primary-50 text-primary-800" : "text-slate-700")}>
              {it.custom ? <><Plus className="h-3.5 w-3.5 text-primary-600" /> Agregar «{it.text}»</> : it.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
