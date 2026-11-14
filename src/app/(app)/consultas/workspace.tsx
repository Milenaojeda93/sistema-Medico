"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FlaskConical, Pill, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "consulta" | "receta" | "estudios";
const Ctx = createContext<{ tab: TabKey; setTab: (t: TabKey) => void }>({ tab: "consulta", setTab: () => {} });
export const useWorkspace = () => useContext(Ctx);

const fromHash = (): TabKey | null => {
  const h = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  return h === "receta" || h === "estudios" || h === "consulta" ? h : null;
};

/** Espacio de trabajo de la consulta: pestañas que no desmontan su contenido (lo escrito no se pierde). */
export function Workspace({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabKey>("consulta");
  useEffect(() => {
    const h = fromHash();
    if (h) setTabState(h);
    const on = () => { const x = fromHash(); if (x) setTabState(x); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const setTab = (t: TabKey) => {
    setTabState(t);
    history.replaceState(null, "", t === "consulta" ? location.pathname + location.search : `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return <Ctx.Provider value={{ tab, setTab }}>{children}</Ctx.Provider>;
}

export function TabNav({ receta, estudios }: { receta?: number | null; estudios?: number | null }) {
  const { tab, setTab } = useWorkspace();
  const items: { key: TabKey; label: string; icon: ReactNode; count?: number | null }[] = [
    { key: "consulta", label: "Consulta", icon: <Stethoscope className="h-4 w-4" /> },
    ...(receta !== undefined ? [{ key: "receta" as const, label: "Receta", icon: <Pill className="h-4 w-4" />, count: receta }] : []),
    ...(estudios !== undefined ? [{ key: "estudios" as const, label: "Estudios", icon: <FlaskConical className="h-4 w-4" />, count: estudios }] : []),
  ];
  return (
    <div role="tablist" className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={tab === it.key} onClick={() => setTab(it.key)}
          className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
            tab === it.key ? "bg-white text-primary-700 shadow-soft" : "text-slate-600 hover:text-slate-900")}>
          {it.icon}{it.label}
          {!!it.count && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", tab === it.key ? "bg-primary-100 text-primary-700" : "bg-slate-200 text-slate-600")}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPane({ name, children }: { name: TabKey; children: ReactNode }) {
  const { tab } = useWorkspace();
  return <div role="tabpanel" hidden={tab !== name}>{children}</div>;
}
