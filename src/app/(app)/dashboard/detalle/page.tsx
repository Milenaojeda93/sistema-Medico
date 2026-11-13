import Link from "next/link";
import { Download } from "lucide-react";
import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { gs } from "@/lib/utils";
import { DETAILS, canSee, detailRows, type Detail } from "../data";
import { parseRange, rangeQuery } from "../range";
import { RangePicker } from "../range-picker";

export const metadata = { title: "Detalle del dashboard" };

export default async function DashboardDetail({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await guard("dashboard");
  const sp = await searchParams;
  const r = parseRange(sp, ctx.tz);
  const visible = (Object.keys(DETAILS) as Detail[]).filter((d) => canSee(ctx, d));
  const tipo = (sp.tipo && visible.includes(sp.tipo as Detail) ? sp.tipo : visible[0]) as Detail | undefined;
  const byDoctor = tipo && !["pacientes", "ingresos", "facturas"].includes(tipo);
  const [{ data: doctors }, table] = await Promise.all([
    byDoctor && !ctx.ownOnly ? ctx.supabase.from("doctors").select("id, full_name").eq("clinic_id", ctx.clinic.id).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    tipo ? detailRows(ctx, tipo, r, { medico: sp.medico, q: sp.q }) : Promise.resolve(null),
  ]);
  const keep = { tipo, medico: sp.medico, q: sp.q };

  return (
    <>
      <PageHeader back={{ href: `/dashboard?${rangeQuery(r)}`, label: "Dashboard" }} title={tipo ? DETAILS[tipo] : "Detalle"}
        description={`${table?.rows.length ?? 0} registro(s) · ${r.label}`}
        actions={tipo && <a href={`/dashboard/detalle/exportar?${rangeQuery(r, keep)}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50"><Download className="h-4 w-4" /> Exportar a Excel</a>} />
      <RangePicker r={r} base="/dashboard/detalle" keep={keep} />
      <Tabs active={tipo ?? ""} tabs={visible.map((d) => ({ key: d, label: DETAILS[d], href: `/dashboard/detalle?${rangeQuery(r, { tipo: d })}` }))} />

      {!tipo || !table ? <Card><EmptyState title="Sin datos disponibles para tu usuario" /></Card> : (
        <Card padded={false}>
          <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
            <input type="hidden" name="tipo" value={tipo} />
            {r.preset === "personalizado" ? <><input type="hidden" name="periodo" value="personalizado" /><input type="hidden" name="desde" value={r.desde} /><input type="hidden" name="hasta" value={r.hasta} /></> : <input type="hidden" name="periodo" value={r.preset} />}
            <label className="sr-only" htmlFor="q">Buscar</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Buscar paciente, documento o médico…" className="input max-w-sm" />
            {byDoctor && !ctx.ownOnly && (
              <>
                <label className="sr-only" htmlFor="medico">Médico</label>
                <select id="medico" name="medico" defaultValue={sp.medico ?? ""} className="input w-auto">
                  <option value="">Todos los médicos</option>
                  {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </>
            )}
            <button className="inline-flex h-9 items-center rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Filtrar</button>
            {(sp.q || sp.medico) && <Link href={`/dashboard/detalle?${rangeQuery(r, { tipo })}`} className="inline-flex h-9 items-center px-2 text-sm text-primary-700 hover:underline">Limpiar</Link>}
          </form>
          {!table.rows.length ? <EmptyState title="No hay registros en este período" description="Probá con otro rango de fechas." /> : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr>{table.columns.map((c, i) => <th key={c} className={table.numeric.includes(i) ? "num" : ""}>{c}</th>)}{table.rows[0]?.badge && <th>Estado</th>}</tr></thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.cells.map((v, j) => (
                        <td key={j} className={table.numeric.includes(j) ? "num" : j === 1 || (tipo === "ingresos" && j === 2) ? "font-medium text-slate-900" : "whitespace-nowrap text-slate-600"}>
                          {j === (tipo === "ingresos" ? 2 : 1) && row.href ? <Link href={row.href} className="hover:text-primary-700 hover:underline">{v}</Link>
                            : table.numeric.includes(j) ? gs(Number(v)) : v}
                        </td>
                      ))}
                      {row.badge && <td>{row.badge.tone === "appt" ? <StatusBadge map={APPOINTMENT_STATUS} value={row.badge.label} /> : <Badge tone={row.badge.tone as "gray"}>{row.badge.label}</Badge>}</td>}
                    </tr>
                  ))}
                </tbody>
                {table.total && (
                  <tfoot><tr><td colSpan={table.columns.length - 1} className="border-t-2 border-slate-200 px-4 py-3 text-right text-sm font-semibold text-slate-700">{table.total.label}</td><td className="num border-t-2 border-slate-200 px-4 py-3 font-bold text-slate-900">{gs(table.total.value)}</td>{table.rows[0]?.badge && <td className="border-t-2 border-slate-200" />}</tr></tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
