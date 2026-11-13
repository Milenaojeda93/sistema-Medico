import Link from "next/link";
import { guard } from "@/lib/context";
import { Card, EmptyState, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { INSURANCE_STATUS } from "@/lib/constants";
import { addDays, fmtDate, todayISO } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";

export const metadata = { title: "Seguros médicos" };

export default async function Insurances({ searchParams }: { searchParams: Promise<{ estado?: string; aseguradora?: string; q?: string }> }) {
  const ctx = await guard("seguros");
  const sp = await searchParams;
  const today = todayISO(ctx.tz);
  const [{ data: all }, { data: insurers }] = await Promise.all([
    ctx.supabase.from("v_patient_insurances").select("*").eq("clinic_id", ctx.clinic.id).order("patient_name"),
    ctx.supabase.from("insurers").select("id, trade_name").eq("clinic_id", ctx.clinic.id).order("trade_name"),
  ]);
  const rows = (all ?? []).filter((i) =>
    (!sp.estado || (sp.estado === "por_vencer" ? i.effective_status === "activo" && i.end_date && i.end_date <= addDays(today, 30) : i.effective_status === sp.estado)) &&
    (!sp.aseguradora || i.insurer_id === sp.aseguradora) &&
    (!sp.q || `${i.patient_name} ${i.patient_document} ${i.member_number}`.toLowerCase().includes(sp.q.toLowerCase())));
  const n = (s: string) => (all ?? []).filter((i) => i.effective_status === s).length;
  const soon = (all ?? []).filter((i) => i.effective_status === "activo" && i.end_date && i.end_date <= addDays(today, 30)).length;

  return (
    <>
      <PageHeader title="Seguros médicos" description="Coberturas registradas de los pacientes. Se agregan desde el perfil de cada paciente." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Cobertura activa" value={n("activo")} tone="green" icon={<ShieldCheck className="h-5 w-5" />} />
        <Stat label="Vence en 30 días" value={soon} tone="amber" icon={<Clock className="h-5 w-5" />} />
        <Stat label="Suspendidos" value={n("suspendido")} tone="amber" icon={<ShieldAlert className="h-5 w-5" />} />
        <Stat label="Vencidos" value={n("vencido")} tone="red" icon={<ShieldX className="h-5 w-5" />} />
      </div>
      <Card padded={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input name="q" defaultValue={sp.q} placeholder="Paciente, documento o N° afiliado" className="input max-w-xs" />
          <select name="aseguradora" defaultValue={sp.aseguradora ?? ""} className="input w-auto"><option value="">Todas las aseguradoras</option>{insurers?.map((i) => <option key={i.id} value={i.id}>{i.trade_name}</option>)}</select>
          <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto">
            <option value="">Todos los estados</option><option value="activo">Activo</option><option value="por_vencer">Por vencer (30 días)</option><option value="suspendido">Suspendido</option><option value="vencido">Vencido</option>
          </select>
          <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Filtrar</button>
        </form>
        {!rows.length ? <EmptyState title="Sin resultados" /> : (
          <table className="table-base">
            <thead><tr><th>Paciente</th><th>Aseguradora</th><th>Plan</th><th>N° afiliado</th><th>Titular</th><th>Vigencia</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/pacientes/${i.patient_id}?tab=seguros`} className="font-medium hover:text-primary-700">{i.patient_name}</Link><p className="text-xs text-slate-500">CI {i.patient_document}</p></td>
                <td>{i.insurer_name}</td><td>{i.plan_name}</td><td className="tabular-nums">{i.member_number}</td>
                <td>{i.holder_name ?? "—"}<p className="text-xs text-slate-500">{i.relationship}</p></td>
                <td className="text-xs">{fmtDate(i.start_date)} → {i.end_date ? fmtDate(i.end_date) : "—"}</td>
                <td><StatusBadge map={INSURANCE_STATUS} value={i.effective_status} /></td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
