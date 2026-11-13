import Link from "next/link";
import { Users, UserPlus, Stethoscope, Clock, CheckCircle2, UserRound, Activity, Banknote, CalendarRange, FileWarning, Building2 } from "lucide-react";
import { guard } from "@/lib/context";
import { Badge, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { ACTION_LABELS, APPOINTMENT_STATUS, TABLE_LABELS } from "@/lib/constants";
import { fmtDateTime, fmtTime, gs } from "@/lib/utils";
import { BySpecialty, CareType, ConsultationsByDay, IncomeByMonth, NewPatients } from "./charts";

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

export default async function Dashboard() {
  const ctx = await guard("dashboard");
  const { data, error } = await ctx.supabase.rpc("dashboard_stats", { p_clinic: ctx.clinic.id });
  if (error) throw new Error(error.message);
  const s = data as Stats;
  const first = (ctx.profile?.full_name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={`Hola${first ? ", " + first : ""}`} description={`Resumen de ${ctx.clinic.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total de pacientes" value={s.total_patients.toLocaleString("es-PY")} hint={`${s.new_patients_month} nuevos este mes`} icon={<Users className="h-5 w-5" />} />
        <Stat label="Consultas del día" value={s.consultations_today} hint={`${s.appointments_today} citas agendadas hoy`} icon={<Stethoscope className="h-5 w-5" />} tone="sky" />
        <Stat label="Ingresos del día" value={gs(s.income_today)} hint={`Mes: ${gs(s.income_month)}`} icon={<Banknote className="h-5 w-5" />} tone="green" />
        <Stat label="Cuentas por cobrar a aseguradoras" value={gs(s.insurer_receivable)} hint="Facturado − pagado − rechazado" icon={<Building2 className="h-5 w-5" />} tone="violet" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Pacientes nuevos (mes)" value={s.new_patients_month} icon={<UserPlus className="h-5 w-5" />} />
        <Stat label="Citas pendientes" value={s.pending_appointments} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <Stat label="Citas confirmadas" value={s.confirmed_appointments} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <Stat label="Médicos disponibles hoy" value={`${s.available_doctors} / ${s.active_doctors}`} icon={<UserRound className="h-5 w-5" />} tone="sky" />
        <Stat label="Consultas realizadas (mes)" value={s.consultations_month} icon={<Activity className="h-5 w-5" />} />
        <Stat label="Facturas pendientes" value={s.pending_invoices} hint={gs(s.pending_invoices_amount)} icon={<FileWarning className="h-5 w-5" />} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Consultas por día · últimos 30 días" className="xl:col-span-2"><ConsultationsByDay data={s.consultations_by_day} /></Card>
        <Card title="Consultas por especialidad · 90 días"><BySpecialty data={s.consultations_by_specialty} /></Card>
        <Card title="Ingresos mensuales" className="xl:col-span-2"><IncomeByMonth data={s.income_by_month} /></Card>
        <Card title="Atención particular vs. por seguro · 90 días"><CareType data={s.care_type_distribution} /></Card>
        <Card title="Pacientes nuevos por mes"><NewPatients data={s.new_patients_by_month} /></Card>

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
