import Link from "next/link";
import { Bell, Search, LogOut, ChevronDown, Building2 } from "lucide-react";
import type { Ctx } from "@/lib/context";
import { can } from "@/lib/context";
import { ROLES } from "@/lib/constants";
import { logout, switchClinic } from "@/app/auth/actions";
import { addDays, todayISO, zonedToUtc } from "@/lib/utils";

async function notifications(ctx: Ctx) {
  const { supabase, clinic, perms, tz } = ctx;
  const items: { text: string; href: string; tone: string }[] = [];
  const today = todayISO(tz);
  const tasks: Promise<void>[] = [];

  if (can(perms, "autorizaciones")) {
    tasks.push((async () => {
      const { count } = await supabase.from("authorizations").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).in("status", ["pendiente", "en_revision"]);
      if (count) items.push({ text: `${count} autorización(es) esperando respuesta de la aseguradora`, href: "/autorizaciones?estado=abiertas", tone: "amber" });
    })());
  }
  if (can(perms, "agenda")) {
    tasks.push((async () => {
      const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("status", "pendiente")
        .gte("starts_at", zonedToUtc(`${today}T00:00`, tz).toISOString()).lt("starts_at", zonedToUtc(`${addDays(today, 2)}T00:00`, tz).toISOString());
      if (count) items.push({ text: `${count} cita(s) de hoy y mañana sin confirmar`, href: "/agenda", tone: "blue" });
    })());
  }
  if (can(perms, "seguros")) {
    tasks.push((async () => {
      const { count } = await supabase.from("patient_insurances").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("status", "activo")
        .gte("end_date", today).lte("end_date", addDays(today, 30));
      if (count) items.push({ text: `${count} seguro(s) de pacientes vencen en los próximos 30 días`, href: "/seguros?estado=por_vencer", tone: "red" });
    })());
  }
  if (can(perms, "facturacion")) {
    tasks.push((async () => {
      const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).in("status", ["pendiente", "parcial"]);
      if (count) items.push({ text: `${count} factura(s) con saldo pendiente del paciente`, href: "/facturacion?estado=pendientes", tone: "amber" });
    })());
  }
  await Promise.all(tasks);
  return items;
}

export async function Topbar({ ctx }: { ctx: Ctx }) {
  const notes = await notifications(ctx);
  const name = ctx.profile?.full_name ?? ctx.user.email ?? "";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((s: string) => s[0]).join("").toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-[#f5f7fb]/80 px-4 pl-16 backdrop-blur-xl backdrop-saturate-150 lg:px-8">
      <form action="/buscar" className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input name="q" placeholder="Buscar pacientes, documentos, teléfonos, facturas…" className="input h-10 rounded-xl pl-9 pr-16" />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:block">Enter</kbd>
      </form>
      <div className="ml-auto flex items-center gap-1">
        <details className="relative">
          <summary className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:shadow-soft hover:ring-1 hover:ring-slate-200" aria-label="Notificaciones">
            <Bell className="h-[19px] w-[19px]" />
            {notes.length > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-[#f5f7fb]">{notes.length}</span>}
          </summary>
          <div className="menu-pop absolute right-0 mt-2 w-80">
            <p className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Notificaciones</p>
            {notes.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-500">Todo al día</p>}
            {notes.map((n) => (
              <Link key={n.text} href={n.href} className="flex gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.tone === "red" ? "bg-rose-500" : n.tone === "amber" ? "bg-amber-500" : "bg-primary-500"}`} />
                {n.text}
              </Link>
            ))}
          </div>
        </details>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-white hover:shadow-soft hover:ring-1 hover:ring-slate-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-semibold text-white ring-2 ring-white shadow-soft">{initials}</span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{name}</span>
              <span className="block text-xs text-slate-500">{ROLES[ctx.role]}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </summary>
          <div className="menu-pop absolute right-0 mt-2 w-72">
            <div className="border-b border-slate-100 px-2.5 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-medium text-slate-800">{name}</p>
              <p className="truncate text-xs text-slate-500">{ctx.user.email}</p>
            </div>
            {ctx.memberships.length > 1 && (
              <div className="border-b border-slate-100 py-2">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Cambiar institución</p>
                {ctx.memberships.map((m) => (
                  <form key={m.clinic.id} action={switchClinic}>
                    <input type="hidden" name="clinic_id" value={m.clinic.id} />
                    <button className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${m.clinic.id === ctx.clinic.id ? "font-semibold text-primary-700" : "text-slate-700"}`}>
                      <Building2 className="h-4 w-4 text-slate-400" /> <span className="truncate">{m.clinic.name}</span>
                    </button>
                  </form>
                ))}
              </div>
            )}
            <form action={logout} className="pt-1">
              <button className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
