"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FileHeart, UserRound, Shapes, ShieldCheck, Building2, BadgeCheck,
  Pill, FlaskConical, Cross, Boxes, Receipt, Wallet, BarChart3, KeyRound, Settings, ScrollText, Menu, X, Crown,
  ChevronDown, ChevronsLeft, ChevronsRight, HeartPulse, CalendarCheck,
} from "lucide-react";
import { MODULES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "./auth-shell";

const ICONS = { LayoutDashboard, Users, CalendarDays, Stethoscope, FileHeart, UserRound, Shapes, ShieldCheck, Building2, BadgeCheck, Pill, FlaskConical, Cross, Boxes, Receipt, Wallet, BarChart3, KeyRound, Settings, ScrollText };
const KEY_COMPACT = "medvia.sidebar";
const KEY_GROUPS = "medvia.sidebar.groups";

function store(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
}
function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function Sidebar({ allowed, isSuper, clinicName, myAppointments = null }: { allowed: string[]; isSuper: boolean; clinicName: string; myAppointments?: number | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  const groups = Array.from(new Set(MODULES.map((m) => m.group)));

  useEffect(() => {
    setCompact(read(KEY_COMPACT) === "compact");
    try { setClosed(JSON.parse(read(KEY_GROUPS) ?? "[]")); } catch { setClosed([]); }
  }, []);

  const toggleCompact = () => {
    const next = !compact;
    setCompact(next);
    store(KEY_COMPACT, next ? "compact" : null);
    if (next) document.documentElement.dataset.sidebar = "compact";
    else delete document.documentElement.dataset.sidebar;
  };
  const toggleGroup = (g: string) => {
    const next = closed.includes(g) ? closed.filter((x) => x !== g) : [...closed, g];
    setClosed(next);
    store(KEY_GROUPS, JSON.stringify(next));
  };
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const mini = compact && !open; // en celular el menú se abre siempre completo
  const initials = clinicName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const item = (key: string, href: string, label: string, Icon: React.ComponentType<{ className?: string }>, phase2 = false, iconClass?: string) => {
    const active = isActive(href);
    return (
      <Link
        key={key}
        href={href}
        title={mini ? label : undefined}
        onClick={() => setOpen(false)}
        className={cn(
          "group relative flex items-center rounded-[10px] text-[13.5px] font-medium transition-colors",
          mini ? "h-10 justify-center" : "gap-3 px-3 py-2",
          active
            ? "bg-gradient-to-r from-white/[0.11] to-white/[0.04] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
          phase2 && !active && "text-slate-500",
        )}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-400 shadow-[0_0_10px_rgb(96_148_250/0.8)]" />}
        <Icon className={cn("h-[17px] w-[17px] shrink-0", iconClass ?? (active ? "text-primary-300" : "text-slate-500 group-hover:text-slate-300"))} />
        {!mini && <span className="truncate">{label}</span>}
        {!mini && phase2 && <span className="ml-auto shrink-0 whitespace-nowrap rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-white/[0.06]">Fase 2</span>}
      </Link>
    );
  };

  const myItem = myAppointments !== null && (() => {
    const active = isActive("/mis-citas");
    return (
      <div className={mini ? "pb-1" : "pb-3"}>
        <Link href="/mis-citas" title={mini ? `Mis citas (${myAppointments} hoy)` : undefined} onClick={() => setOpen(false)}
          className={cn("group relative flex items-center rounded-[10px] text-[13.5px] font-semibold transition-colors",
            mini ? "h-10 justify-center" : "gap-3 px-3 py-2.5",
            active ? "bg-primary-600 text-white shadow-[0_4px_14px_-4px_rgb(37_99_235/0.7)]" : "bg-primary-500/15 text-primary-100 ring-1 ring-inset ring-primary-400/25 hover:bg-primary-500/25")}>
          <CalendarCheck className="h-[18px] w-[18px] shrink-0" />
          {!mini && <span className="flex-1 truncate">Mis citas</span>}
          {myAppointments > 0 && (mini
            ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-ink-900">{myAppointments}</span>
            : <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold leading-none text-white" aria-label={`${myAppointments} pacientes por atender hoy`}>{myAppointments}</span>)}
          {!mini && myAppointments === 0 && <span className="text-[11px] font-normal text-primary-200/70">Al día</span>}
        </Link>
      </div>
    );
  })();

  const nav = (
    <nav className={cn("flex-1 overflow-y-auto py-4 [scrollbar-color:rgb(255_255_255/0.12)_transparent] [scrollbar-width:thin]", mini ? "space-y-3 px-2" : "space-y-1 px-3")}>
      {myItem}
      {groups.map((g) => {
        const items = MODULES.filter((m) => m.group === g && allowed.includes(m.key));
        if (!items.length) return null;
        const isClosed = closed.includes(g) && !mini;
        const hasActive = items.some((m) => isActive(m.href));
        return (
          <div key={g} className={mini ? "space-y-1 border-t border-white/[0.06] pt-3 first:border-t-0 first:pt-0" : "pb-2"}>
            {!mini && (
              <button type="button" onClick={() => toggleGroup(g)} aria-expanded={!isClosed}
                className="group/h mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
                <span className="flex-1">{g}</span>
                {isClosed && hasActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />}
                {isClosed && <span className="rounded bg-white/[0.06] px-1.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">{items.length}</span>}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isClosed && "-rotate-90")} />
              </button>
            )}
            {!isClosed && (
              <div className="space-y-0.5">
                {items.map((m) => item(m.key, m.href, m.label, ICONS[m.icon as keyof typeof ICONS], "phase2" in m && Boolean(m.phase2)))}
              </div>
            )}
          </div>
        );
      })}
      {isSuper && (
        <div className={mini ? "border-t border-white/[0.06] pt-3" : "pb-2"}>
          {!mini && <p className="mb-1 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Plataforma</p>}
          {item("superadmin", "/superadmin", "Superadministrador", Crown, false, "text-amber-400")}
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
      <aside className={cn(
        "no-print fixed inset-y-0 left-0 z-50 flex flex-col bg-ink-900 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(37_99_235/0.18),transparent_60%)] text-slate-300 transition-[transform,width] duration-200 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full", mini ? "w-[76px]" : "w-[264px]",
      )}>
        <div className={cn("flex h-16 items-center", mini ? "justify-center px-2" : "justify-between px-5")}>
          {mini ? (
            <Link href="/dashboard" title="Medvia" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-400 via-primary-500 to-primary-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_12px_-2px_rgb(37_99_235/0.55)]">
              <HeartPulse className="h-[18px] w-[18px]" />
            </Link>
          ) : <Link href="/dashboard"><Logo light /></Link>}
          {!mini && (
            <>
              <button className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 lg:block" onClick={toggleCompact} title="Contraer menú" aria-label="Contraer menú">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="h-5 w-5 text-slate-400" /></button>
            </>
          )}
        </div>
        {mini ? (
          <div className="flex flex-col items-center gap-2 px-2">
            <span title={clinicName} className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-primary-600 text-xs font-semibold text-white">{initials}</span>
            <button onClick={toggleCompact} title="Expandir menú" aria-label="Expandir menú" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mx-3 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-primary-600 text-xs font-semibold text-white shadow-inner">{initials}</span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-500">Institución</p>
              <p className="truncate text-sm font-semibold text-white">{clinicName}</p>
            </div>
          </div>
        )}
        {nav}
        {!mini && (
          <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/0.9)]" /> Datos cifrados y aislados por institución</span>
          </div>
        )}
      </aside>
    </>
  );
}
