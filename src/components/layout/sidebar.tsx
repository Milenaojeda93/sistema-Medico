"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FileHeart, UserRound, Shapes, ShieldCheck, Building2, BadgeCheck,
  Pill, FlaskConical, Cross, Boxes, Receipt, Wallet, BarChart3, KeyRound, Settings, ScrollText, Menu, X, Crown,
} from "lucide-react";
import { MODULES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "./auth-shell";

const ICONS = { LayoutDashboard, Users, CalendarDays, Stethoscope, FileHeart, UserRound, Shapes, ShieldCheck, Building2, BadgeCheck, Pill, FlaskConical, Cross, Boxes, Receipt, Wallet, BarChart3, KeyRound, Settings, ScrollText };

export function Sidebar({ allowed, isSuper, clinicName }: { allowed: string[]; isSuper: boolean; clinicName: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(MODULES.map((m) => m.group)));

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 [scrollbar-color:rgb(255_255_255/0.12)_transparent] [scrollbar-width:thin]">
      {groups.map((g) => {
        const items = MODULES.filter((m) => m.group === g && allowed.includes(m.key));
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">{g}</p>
            {items.map((m) => {
              const Icon = ICONS[m.icon as keyof typeof ICONS];
              const active = path === m.href || path.startsWith(m.href + "/");
              const phase2 = "phase2" in m && m.phase2;
              return (
                <Link
                  key={m.key}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-gradient-to-r from-white/[0.11] to-white/[0.04] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
                    phase2 && !active && "text-slate-500",
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-400 shadow-[0_0_10px_rgb(96_148_250/0.8)]" />}
                  <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-primary-300" : "text-slate-500 group-hover:text-slate-300")} />
                  <span className="truncate">{m.label}</span>
                  {phase2 && <span className="ml-auto shrink-0 whitespace-nowrap rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-white/[0.06]">Fase 2</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
      {isSuper && (
        <div>
          <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Plataforma</p>
          <Link href="/superadmin" className={cn("flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium", path.startsWith("/superadmin") ? "bg-white/[0.09] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100")}>
            <Crown className="h-[17px] w-[17px] text-amber-400" /> Superadministrador
          </Link>
        </div>
      )}
    </nav>
  );

  return (
    <>
      <button className="fixed left-3 top-3 z-40 rounded-xl bg-white p-2 shadow-soft ring-1 ring-slate-200 lg:hidden no-print" onClick={() => setOpen(true)} aria-label="Abrir menú">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("no-print fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-ink-900 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(37_99_235/0.18),transparent_60%)] text-slate-300 transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard"><Logo light /></Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="mx-3 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-primary-600 text-xs font-semibold text-white shadow-inner">
            {clinicName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-500">Institución</p>
            <p className="truncate text-sm font-semibold text-white">{clinicName}</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/0.9)]" /> Datos cifrados y aislados por institución</span>
        </div>
      </aside>
    </>
  );
}
