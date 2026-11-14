import Link from "next/link";
import { CalendarDays, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { guard } from "@/lib/context";
import { Card, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { addDays, fmtTime, todayISO, zonedToUtc } from "@/lib/utils";
import { MyDay } from "../dashboard/my-day";
import { AttendedBanner } from "../dashboard/attended-banner";

export const metadata = { title: "Mis citas" };

type Row = {
  id: string; starts_at: string; status: string; care_type: string; reason: string | null;
  patients: { id: string; first_name: string; last_name: string } | null;
  patient_insurances: { insurers: { trade_name: string } | null } | null;
};

export default async function MisCitas({ searchParams }: { searchParams: Promise<{ atendido?: string }> }) {
  const ctx = await guard("agenda");
  const sp = await searchParams;
  if (!ctx.myDoctorIds.length) {
    return (
      <>
        <PageHeader title="Mis citas" />
        <Notice tone="amber">Tu usuario no está vinculado a una ficha de profesional. Pedile al administrador que lo vincule en <b>Médicos y profesionales</b>.</Notice>
      </>
    );
  }
  const today = todayISO(ctx.tz);
  const from = zonedToUtc(`${addDays(today, 1)}T00:00`, ctx.tz).toISOString();
  const to = zonedToUtc(`${addDays(today, 8)}T00:00`, ctx.tz).toISOString();
  const { data } = await ctx.supabase.from("appointments")
    .select("id, starts_at, status, care_type, reason, patients(id, first_name, last_name), patient_insurances(insurers(trade_name))")
    .eq("clinic_id", ctx.clinic.id).in("doctor_id", ctx.myDoctorIds).gte("starts_at", from).lt("starts_at", to)
    .in("status", ["pendiente", "confirmada", "en_espera"]).order("starts_at");
  const rows = (data ?? []) as unknown as Row[];
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const d = dayOf(r.starts_at); groups.set(d, [...(groups.get(d) ?? []), r]); }
  const dayLabel = (d: string) => {
    const label = new Intl.DateTimeFormat("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
    return (d === addDays(today, 1) ? "Mañana · " : "") + label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <>
      <PageHeader title="Mis citas" description="Los pacientes que la recepción te agendó. Tocá «Atender» para abrir la consulta." />
      <AttendedBanner ctx={ctx} consultationId={sp.atendido} />
      <MyDay ctx={ctx} showUpcoming={false} title="Hoy" />

      <h2 className="mb-3 mt-2 text-lg font-semibold text-slate-900">Próximos 7 días</h2>
      {!rows.length ? (
        <Card><p className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-5 w-5 text-slate-400" /> No tenés citas agendadas para los próximos días.</p></Card>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([d, list]) => (
            <div key={d} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{dayLabel(d)}</p>
                <Link href={`/agenda?vista=dia&fecha=${d}`} className="text-xs font-medium text-primary-600 hover:underline">{list.length} cita{list.length === 1 ? "" : "s"} · ver en la agenda</Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-slate-700">{fmtTime(r.starts_at, ctx.tz)}</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      {r.patients ? <Link href={`/pacientes/${r.patients.id}`} className="block truncate font-medium text-slate-800 hover:text-primary-700">{r.patients.first_name} {r.patients.last_name}</Link> : <span className="font-medium">Paciente</span>}
                      <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                        {r.care_type === "seguro"
                          ? <span className="inline-flex items-center gap-1 text-primary-700"><ShieldCheck className="h-3.5 w-3.5" />{r.patient_insurances?.insurers?.trade_name ?? "Seguro"}</span>
                          : <span className="inline-flex items-center gap-1 text-orange-700"><Wallet className="h-3.5 w-3.5" />Particular</span>}
                        {r.reason && <span className="truncate">{r.reason}</span>}
                      </span>
                    </span>
                    <StatusBadge map={APPOINTMENT_STATUS} value={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
