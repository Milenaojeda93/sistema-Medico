import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, Clock, ShieldCheck, Stethoscope, UserRound, Wallet } from "lucide-react";
import type { Ctx } from "@/lib/context";
import { StatusBadge, btnClass } from "@/components/ui";
import { APPOINTMENT_STATUS, realAllergies } from "@/lib/constants";
import { addDays, age, cn, fmtTime, todayISO, zonedToUtc } from "@/lib/utils";
import { AutoRefresh } from "./auto-refresh";
import { AttendButton } from "../consultas/attend-button";

type Row = {
  id: string; starts_at: string; ends_at: string; status: string; care_type: string; reason: string | null;
  patients: { id: string; first_name: string; last_name: string; document: string; birth_date: string | null; allergies: string | null } | null;
  patient_insurances: { insurers: { trade_name: string } | null } | null;
  consultations: { id: string; status: string }[] | null;
};

const ACTIVE = ["pendiente", "confirmada", "en_espera", "en_atencion"];
const fmtCI = (d: string) => (/^\d+$/.test(d) ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d);
const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Panel de inicio del médico: sus pacientes de hoy con botón para atender. */
export async function MyDay({ ctx, showUpcoming = true, title = "Tus pacientes de hoy" }: { ctx: Ctx; showUpcoming?: boolean; title?: string }) {
  const tz = ctx.tz;
  const today = todayISO(tz);
  const from = zonedToUtc(`${today}T00:00`, tz).toISOString();
  const to = zonedToUtc(`${addDays(today, 1)}T00:00`, tz).toISOString();
  const weekTo = zonedToUtc(`${addDays(today, 8)}T00:00`, tz).toISOString();
  const sel = "id, starts_at, ends_at, status, care_type, reason, patients(id, first_name, last_name, document, birth_date, allergies), patient_insurances(insurers(trade_name)), consultations(id, status)";

  const [{ data: todayRows }, { data: nextRows }] = await Promise.all([
    ctx.supabase.from("appointments").select(sel).eq("clinic_id", ctx.clinic.id).in("doctor_id", ctx.myDoctorIds)
      .gte("starts_at", from).lt("starts_at", to).neq("status", "cancelada").order("starts_at"),
    ctx.supabase.from("appointments").select("id, starts_at").eq("clinic_id", ctx.clinic.id).in("doctor_id", ctx.myDoctorIds)
      .gte("starts_at", to).lt("starts_at", weekTo).in("status", ACTIVE).order("starts_at"),
  ]);
  const rows = (todayRows ?? []) as unknown as Row[];
  const now = Date.now();
  const pending = rows.filter((r) => ACTIVE.includes(r.status));
  const done = rows.filter((r) => r.status === "atendida").length;
  const inCare = rows.find((r) => r.status === "en_atencion");
  // El próximo: el que está en atención; si no, el que ya llegó (en espera); si no, el primero que no terminó.
  const next = inCare ?? pending.find((r) => r.status === "en_espera") ?? pending.find((r) => new Date(r.ends_at).getTime() >= now - 30 * 60_000) ?? pending[0];

  // Próximos días agrupados
  const byDay = new Map<string, number>();
  for (const r of nextRows ?? []) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(r.starts_at));
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  const attend = (r: Row) => {
    const open = r.consultations?.find((c) => c.status === "abierta");
    return open ? { href: `/consultas/${open.id}`, label: "Continuar consulta" } : null;
  };
  const name = (r: Row) => (r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : "Paciente");
  const care = (r: Row) => r.care_type === "seguro"
    ? <span className="inline-flex items-center gap-1 text-primary-700"><ShieldCheck className="h-3.5 w-3.5" />{r.patient_insurances?.insurers?.trade_name ?? "Seguro"}</span>
    : <span className="inline-flex items-center gap-1 text-orange-700"><Wallet className="h-3.5 w-3.5" />Particular</span>;

  return (
    <section className="mb-6">
      <AutoRefresh seconds={60} />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            {rows.length === 0 ? "No tenés citas agendadas para hoy." : <>{pending.length} por atender · {done} atendido{done === 1 ? "" : "s"} · se actualiza solo</>}
          </p>
        </div>
        <Link href="/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">Ver mi agenda completa <ChevronRight className="h-4 w-4" /></Link>
      </div>

      {next && (
        <div className="card mb-4 overflow-hidden border-primary-200 ring-1 ring-primary-100">
          <div className="flex flex-wrap items-center gap-5 bg-gradient-to-r from-primary-50 to-white p-5">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-600 text-white shadow-soft">
              <span className="text-lg font-semibold tabular-nums leading-none">{fmtTime(next.starts_at, tz)}</span>
              <span className="mt-1 text-[10px] uppercase tracking-wide text-primary-100">{next.status === "en_atencion" ? "ahora" : "próximo"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{next.status === "en_atencion" ? "En atención" : "Próximo paciente"}</p>
              <p className="truncate text-xl font-semibold text-slate-900">{name(next)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                {next.patients && <span>CI {fmtCI(next.patients.document)}</span>}
                {next.patients?.birth_date && <span>{age(next.patients.birth_date)} años</span>}
                {care(next)}
                {next.reason && <span className="truncate">Motivo: {next.reason}</span>}
              </p>
              {realAllergies(next.patients?.allergies) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-100">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alergias: {realAllergies(next.patients?.allergies)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {(() => { const a = attend(next); return a
                ? <Link href={a.href} className={cn(btnClass("primary"), "h-12 px-6 text-base")}><Stethoscope className="h-5 w-5" /> {a.label}</Link>
                : <AttendButton appointmentId={next.id} size="md" className="h-12 px-6 text-base" />; })()}
              {next.patients && <Link href={`/pacientes/${next.patients.id}`} className="text-xs font-medium text-slate-500 hover:text-primary-600">Ver ficha e historia</Link>}
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const active = ACTIVE.includes(r.status);
              const late = active && r.status !== "en_atencion" && new Date(r.ends_at).getTime() < now;
              const a = attend(r);
              return (
                <li key={r.id} className={cn("flex flex-wrap items-center gap-4 px-5 py-3", r.id === next?.id && "bg-primary-50/40", !active && "opacity-60")}>
                  <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-slate-700">{fmtTime(r.starts_at, tz)}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{name(r)}</span>
                    <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      {care(r)}
                      {r.reason && <span className="truncate">{r.reason}</span>}
                      {late && <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="h-3 w-3" /> Demorado</span>}
                    </span>
                  </span>
                  <StatusBadge map={APPOINTMENT_STATUS} value={r.status} />
                  {active
                    ? (a ? <Link href={a.href} className={btnClass(r.id === next?.id ? "primary" : "secondary", "sm")}><Stethoscope className="h-4 w-4" /> {a.label}</Link>
                      : <AttendButton appointmentId={r.id} variant={r.id === next?.id ? "primary" : "secondary"} />)
                    : r.status === "atendida"
                      ? <span className="inline-flex w-[118px] items-center justify-end gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Atendido</span>
                      : <span className="w-[118px]" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showUpcoming && byDay.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-slate-500"><CalendarDays className="h-4 w-4" /> Próximos días:</span>
          {[...byDay.entries()].map(([d, n]) => (
            <Link key={d} href={`/agenda?vista=dia&fecha=${d}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700">
              {WD[new Date(d + "T12:00:00Z").getUTCDay()]} {d.slice(8, 10)}/{d.slice(5, 7)} · {n} cita{n === 1 ? "" : "s"}
            </Link>
          ))}
        </div>
      )}
      {rows.length === 0 && (byDay.size === 0 || !showUpcoming) && (
        <div className="card flex items-center gap-3 p-5 text-sm text-slate-500"><CalendarClock className="h-5 w-5 text-slate-400" /> Cuando la recepción te agende un paciente, va a aparecer acá.</div>
      )}
    </section>
  );
}
