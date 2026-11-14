"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Circle, Loader2, Save } from "lucide-react";
import { btnClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Barra fija al pie durante la atención: guardar o finalizar (el paciente queda como atendido). */
export function FinishBar({ patient, checks, draftLabel = "Guardar" }: {
  patient: string; checks?: { label: string; done: boolean; href?: string }[]; draftLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <div className="h-24" aria-hidden="true" />
      <div className="finish-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Atención en curso</p>
            <p className="truncate font-semibold text-slate-900">{patient}</p>
          </div>
          {checks && (
            <ul className="hidden items-center gap-4 text-xs text-slate-600 md:flex">
              {checks.map((c) => (
                <li key={c.label}>
                  {(() => {
                    const inner = <>{c.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-slate-300" />}<span className={c.done ? "text-slate-800" : ""}>{c.label}</span></>;
                    return c.href
                      ? <a href={c.href} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-100 hover:text-primary-700">{inner}</a>
                      : <span className="flex items-center gap-1.5 px-1.5 py-1">{inner}</span>;
                  })()}
                </li>
              ))}
            </ul>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="submit" disabled={pending} className={btnClass("secondary")}><Save className="h-4 w-4" /> {draftLabel}</button>
            <button type="submit" name="close" value="1" disabled={pending}
              onClick={(e) => { if (!window.confirm(`¿Finalizar la atención de ${patient}?\n\nLa consulta se guarda y el paciente queda como ATENDIDO. Después solo se puede corregir con una enmienda.`)) e.preventDefault(); }}
              className={cn(btnClass("success"), "h-11 px-5 text-base")}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Finalizar atención
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
