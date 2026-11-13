import Link from "next/link";
import { UserPlus, Stethoscope, Clock, CheckCircle2, UserRound, Activity, Banknote, CalendarRange, CalendarX2, FileWarning, Building2 } from "lucide-react";
import { guard } from "@/lib/context";
import { Badge, Card, Notice, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { ACTION_LABELS, APPOINTMENT_STATUS, TABLE_LABELS } from "@/lib/constants";
import { fmtDateTime, fmtTime, gs } from "@/lib/utils";
import { BySpecialty, CareType, ConsultationsByDay, IncomeByMonth, NewPatients } from "./charts";
import { canSee, cardCounts, rangeCharts, type Detail } from "./data";
import { parseRange, rangeQuery } from "./range";
import { RangePicker } from "./range-picker";

export const metadata = { title: "Dashboard" };

type Stats = {
  total_patients: number; new_patients_month: number; consultations_today: number; appointments_today: number;
  pending_appointments: number; confirmed_appointments: number; available_doctors: number; active_doctors: number;
  consultations_month: number; income_today: number; income_month: number; pending_invoices: number;
  pending_invoices_amount: number; insurer_receivable: number;
  consultations_by_day: { date: string; total: number }[];
  consultations_by_specialty: { name: string; total: number }[];
  income_by_month: { month: string; particular: number; aseguradoras: number }[];
  new_patients_by_month: { month: string; total: number }[];
  care_type_distribution: { name: string; total: number }[];
  upcoming: { id: string; starts_at: string; status: string; care_type: string; patient: string; doctor: string; specialty: string | null }[];
  activity: { table_name: string; action: string; created_at: string; user_name: string }[];
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await guard("dashboard");
  const sp = await searchParams;
  const r = parseRange(sp, ctx.tz);
  const [{ data, error }, n, ch] = await Promise.all([
    ctx.supabase.rpc("dashboard_stats", { p_clinic: ctx.clinic.id }),
    cardCounts(ctx, r),
    rangeCharts(ctx, r),
  ]);
  if (error) throw new Error(error.message);
  const s = data as Stats;
  const first = (ctx.profile?.full_name ?? "").split(" ")[0];
  const own = ctx.ownOnly;
  const money = canSee(ctx, "ingresos");
  const href = (tipo: string) => `/dashboard/detalle?${rangeQuery(r, { tipo })}`;
  const link = (tipo: Detail) => (canSee(ctx, tipo) ? href(tipo) : undefined);

  return (
    <>
      <PageHeader title={`Hola${first ? ", " + first : ""}`} description={own ? "Tu resumen: tus pacientes, tu agenda y tus consultas" : `Resumen de ${ctx.clinic.name}`} />
      {own && !ctx.myDoctorIds.length && <div className="mb-4"><Notice tone="amber">Tu usuario todavía no está vinculado a una ficha de profesional. Pedile al administrador que lo vincule en <b>Médicos y profesionales</b>.</Notice></div>}
      <RangePicker r={r} base="/dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(<Stat href={link("citas")} label="Citas agendadas" value={n.citas} hint={`${n.atendidas} atendidas`} icon={<CalendarRange className="h-5 w-5" />} tone="sky" />)}
        {(<Stat href={link("consultas")} label="Consultas realizadas" value={n.consultas} icon={<Stethoscope className="h-5 w-5" />} />)}
        {money
          ? (<Stat href={link("ingresos")} label="Ingresos" value={gs(n.ingresos_particular + n.ingresos_aseguradoras)} hint={`Pacientes ${gs(n.ingresos_particular)} · Aseguradoras ${gs(n.ingresos_aseguradoras)}`} icon={<Banknote className="h-5 w-5" />} tone="green" />)
          : (<Stat href={link("pendientes")} label="Citas pendientes" value={n.pendientes} hint="Por confirmar" icon={<Clock className="h-5 w-5" />} tone="amber" />)}
        {(<Stat href={link("pacientes")} label={own ? "Pacientes nuevos" : "Pacientes nuevos"} value={n.pacientes} hint={`${s.total_patients.toLocaleString("es-PY")} ${own ? "pacientes tuyos" : "pacientes en total"}`} icon={<UserPlus className="h-5 w-5" />} tone="violet" />)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {money && (<Stat href={link("pendientes")} label="Citas pendientes" value={n.pendientes} hint="Por confirmar" icon={<Clock className="h-5 w-5" />} tone="amber" />)}
        {(<Stat href={link("confirmadas")} label="Citas confirmadas" value={n.confirmadas} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />)}
        {(<Stat href={link("no_concretadas")} label="Canceladas y ausentes" value={n.no_concretadas} icon={<CalendarX2 className="h-5 w-5" />} tone="red" />)}
        {money
          ? (<Stat href={link("facturas")} label="Facturas con saldo" value={n.facturas} hint={`Saldo ${gs(n.facturas_saldo)}`} icon={<FileWarning className="h-5 w-5" />} tone="red" />)
          : (<Stat href={link("atendidas")} label="Citas atendidas" value={n.atendidas} icon={<Activity className="h-5 w-5" />} tone="violet" />)}
      </div>
      {money && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Stat href="/facturacion/aseguradoras" linkLabel="Ver liquidaciones" label="Por cobrar a aseguradoras (total)" value={gs(s.insurer_receivable)} hint="Facturado − pagado − rechazado" icon={<Building2 className="h-5 w-5" />} tone="violet" />
          <Stat href="/medicos" linkLabel="Ver médicos" label="Médicos disponibles hoy" value={`${s.available_doctors} / ${s.active_doctors}`} hint="Con horario de atención hoy" icon={<UserRound className="h-5 w-5" />} tone="sky" />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title={`Consultas por ${ch.byMonth ? "mes" : "día"} · ${r.label}`} className="xl:col-span-2"><ConsultationsByDay data={ch.consultations} byMonth={ch.byMonth} /></Card>
        <Card title="Consultas por especialidad · período"><BySpecialty data={ch.bySpecialty} /></Card>
        {!own && <Card title="Ingresos mensuales · últimos 6 meses" className="xl:col-span-2"><IncomeByMonth data={s.income_by_month} /></Card>}
        <Card title="Particular vs. por seguro · período"><CareType data={ch.careType} /></Card>
        <Card title="Pacientes nuevos por mes · últimos 6 meses"><NewPatients data={s.new_patients_by_month} /></Card>

        <Card title="Próximas citas" padded={false} actions={<Link href="/agenda" className="text-xs font-medium text-primary-600 hover:underline">Ver agenda</Link>}>
          {s.upcoming.length === 0 && <p className="p-5 text-sm text-slate-500">No hay citas próximas.</p>}
          <ul className="divide-y divide-slate-100">
            {s.upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-sm font-semibold text-slate-900">{fmtTime(a.starts_at, ctx.tz)}</p>
                  <p className="text-[11px] text-slate-400">{fmtDateTime(a.starts_at, ctx.tz).slice(0, 5)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{a.patient}</p>
                  <p className="truncate text-xs text-slate-500">{a.doctor}{a.specialty ? ` · ${a.specialty}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge map={APPOINTMENT_STATUS} value={a.status} />
                  {a.care_type === "seguro" && <Badge tone="blue">Seguro</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Actividad reciente" padded={false}>
          <ul className="divide-y divide-slate-100">
            {s.activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                <div>
                  <p className="text-slate-700"><b className="font-medium">{a.user_name}</b> {ACTION_LABELS[a.action]} {(TABLE_LABELS[a.table_name] ?? a.table_name).toLowerCase()}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(a.created_at, ctx.tz)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
