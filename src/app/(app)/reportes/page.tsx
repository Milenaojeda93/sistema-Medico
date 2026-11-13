import { Activity, Ban, CalendarX2, CheckCircle2, Download, FileText, ShieldCheck, Wallet } from "lucide-react";
import { guard } from "@/lib/context";
import { Card, EmptyState, PageHeader, Stat, Tabs } from "@/components/ui";
import { gs } from "@/lib/utils";
import { attentionReport, billingReport, diagnosisReport, parseFilters, type Table } from "./data";

export const metadata = { title: "Reportes" };

const TABS = { atenciones: "Atenciones", diagnosticos: "Diagnósticos", facturacion: "Facturación" } as const;

function ReportTable({ t }: { t: Table }) {
  const max = Math.max(1, ...t.rows.map((r) => Number(r[1]) || 0));
  return (
    <Card title={t.title} padded={false}>
      {!t.rows.length ? <EmptyState title="Sin datos para este período" /> : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr>{t.columns.map((c, i) => <th key={i} className={i > 0 ? "num" : ""}>{c}</th>)}</tr></thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={j > 0 ? "num" : "font-medium text-slate-900"}>
                      {j === 1 && typeof v === "number" && !t.money?.includes(1) ? (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:inline-block"><span className="block h-full rounded-full bg-primary-500" style={{ width: `${(v / max) * 100}%` }} /></span>
                          {v}
                        </span>
                      ) : t.money?.includes(j) ? gs(v) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await guard("reportes");
  const sp = await searchParams;
  const f = parseFilters(sp, ctx.tz);
  const tab = (sp.tab && sp.tab in TABS ? sp.tab : "atenciones") as keyof typeof TABS;
  const [{ data: doctors }, { data: specialties }, { data: insurers }] = await Promise.all([
    ctx.supabase.from("doctors").select("id, full_name").eq("clinic_id", ctx.clinic.id).order("full_name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).order("name"),
    ctx.supabase.from("insurers").select("id, trade_name").eq("clinic_id", ctx.clinic.id).order("trade_name"),
  ]);
  const qs = (o: Record<string, string>) => new URLSearchParams(Object.fromEntries(Object.entries({ ...f, tab, ...o }).filter(([, v]) => v))).toString();

  const att = tab === "atenciones" ? await attentionReport(ctx, f) : null;
  const dx = tab === "diagnosticos" ? await diagnosisReport(ctx, f) : null;
  const bill = tab === "facturacion" ? await billingReport(ctx, f) : null;

  return (
    <>
      <PageHeader title="Reportes" description="Indicadores de atención, diagnósticos y facturación con filtros"
        actions={<a href={`/reportes/exportar?${qs({ tipo: tab })}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50"><Download className="h-4 w-4" /> Exportar a Excel</a>} />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <input type="hidden" name="tab" value={tab} />
          <label><span className="label">Desde</span><input type="date" name="desde" defaultValue={f.desde} className="input" /></label>
          <label><span className="label">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="input" /></label>
          <label><span className="label">Médico</span><select name="medico" defaultValue={f.medico} className="input"><option value="">Todos</option>{doctors?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></label>
          <label><span className="label">Especialidad</span><select name="especialidad" defaultValue={f.especialidad} className="input"><option value="">Todas</option>{specialties?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="label">Aseguradora</span><select name="aseguradora" defaultValue={f.aseguradora} className="input"><option value="">Todas</option>{insurers?.map((i) => <option key={i.id} value={i.id}>{i.trade_name}</option>)}</select></label>
          <button className="inline-flex h-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-primary-500 to-primary-600 px-3.5 text-sm font-medium text-white shadow-soft ring-1 ring-inset ring-primary-700/40 hover:from-primary-600 hover:to-primary-700">Aplicar filtros</button>
        </form>
      </Card>

      <Tabs active={tab} tabs={Object.entries(TABS).map(([k, v]) => ({ key: k, label: v, href: `/reportes?${qs({ tab: k })}` }))} />

      {att && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Citas en el período" value={att.summary.total} icon={<Activity />} />
            <Stat label="Atendidas" value={att.summary.atendidas} hint={`${att.summary.total ? Math.round((att.summary.atendidas / att.summary.total) * 100) : 0}% de las citas`} icon={<CheckCircle2 />} tone="green" />
            <Stat label="Canceladas" value={att.summary.canceladas} icon={<Ban />} tone="amber" />
            <Stat label="Ausentes" value={att.summary.ausentes} hint="El paciente no se presentó" icon={<CalendarX2 />} tone="red" />
            <Stat label="Particular / Seguro" value={`${att.summary.particular} / ${att.summary.seguro}`} icon={<ShieldCheck />} tone="violet" />
          </div>
          {att.tables.map((t) => <ReportTable key={t.title} t={t} />)}
        </div>
      )}

      {dx && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Consultas con diagnóstico" value={dx.total} icon={<FileText />} />
            <Stat label="Diagnósticos distintos" value={dx.table.rows.length} icon={<Activity />} tone="sky" />
          </div>
          <ReportTable t={dx.table} />
        </div>
      )}

      {bill && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Total facturado" value={gs(bill.summary.total)} hint={`${bill.summary.facturas} facturas`} icon={<Wallet />} />
            <Stat label="A cargo de aseguradoras" value={gs(bill.summary.aseguradoras)} icon={<ShieldCheck />} tone="violet" />
            <Stat label="A cargo de pacientes" value={gs(bill.summary.pacientes)} icon={<Activity />} tone="sky" />
            <Stat label="Cobrado a pacientes" value={gs(bill.summary.cobrado)} icon={<CheckCircle2 />} tone="green" />
            <Stat label="Pendiente de pacientes" value={gs(bill.summary.pendiente)} icon={<Ban />} tone="red" />
          </div>
          {(f.medico || f.especialidad) && <p className="text-xs text-slate-500">Los filtros de médico y especialidad no aplican a facturación.</p>}
          {bill.tables.map((t) => <ReportTable key={t.title} t={t} />)}
        </div>
      )}
    </>
  );
}
