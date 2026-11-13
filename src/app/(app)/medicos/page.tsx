import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { WEEKDAYS } from "@/lib/constants";
import { addDays, todayISO, zonedToUtc } from "@/lib/utils";

const PERIODS = { mes: "Este mes", mes_anterior: "Mes anterior", "90d": "Últimos 90 días", anio: "Este año" } as const;
type Period = keyof typeof PERIODS;

function range(p: Period, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  if (p === "mes_anterior") {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    return [`${py}-${String(pm).padStart(2, "0")}-01`, first];
  }
  if (p === "90d") return [addDays(today, -89), addDays(today, 1)];
  if (p === "anio") return [`${y}-01-01`, addDays(today, 1)];
  return [first, addDays(today, 1)];
}

export const metadata = { title: "Médicos y profesionales" };

export default async function Doctors({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const ctx = await guard("medicos");
  const sp = await searchParams;
  const period = (sp.periodo && sp.periodo in PERIODS ? sp.periodo : "mes") as Period;
  const [from, to] = range(period, todayISO(ctx.tz));
  const [{ data }, { data: visits }] = await Promise.all([
    ctx.supabase.from("doctors")
      .select("id, full_name, license_number, phone, email, active, rooms(name), doctor_specialties(specialties(name)), doctor_schedules(weekday, start_time, end_time)")
      .eq("clinic_id", ctx.clinic.id).order("active", { ascending: false }).order("full_name"),
    ctx.supabase.from("appointments").select("doctor_id, care_type")
      .eq("clinic_id", ctx.clinic.id).eq("status", "atendida")
      .gte("starts_at", zonedToUtc(`${from}T00:00`, ctx.tz).toISOString()).lt("starts_at", zonedToUtc(`${to}T00:00`, ctx.tz).toISOString())
      .limit(50000),
  ]);
  const stats: Record<string, { particular: number; seguro: number }> = {};
  for (const v of visits ?? []) {
    const s = (stats[v.doctor_id] ??= { particular: 0, seguro: 0 });
    if (v.care_type === "seguro") s.seguro++; else s.particular++;
  }
  const totP = Object.values(stats).reduce((a, s) => a + s.particular, 0);
  const totS = Object.values(stats).reduce((a, s) => a + s.seguro, 0);
  return (
    <>
      <PageHeader title="Médicos y profesionales" description={`${data?.filter((d) => d.active).length ?? 0} activos`}
        actions={can(ctx.perms, "medicos", "create") && <LinkButton href="/medicos/nuevo"><Plus className="h-4 w-4" /> Nuevo profesional</LinkButton>} />
      <Card padded={false} className="mb-6" title="Pacientes atendidos por médico: particular vs. seguro"
        actions={<span className="text-xs text-slate-500">Total: <b className="text-slate-800">{totP + totS}</b> · Particular <b className="text-orange-700">{totP}</b> · Seguro <b className="text-primary-700">{totS}</b></span>}>
        <div className="px-5 pt-4"><Tabs active={period} tabs={Object.entries(PERIODS).map(([k, v]) => ({ key: k, label: v, href: `/medicos?periodo=${k}` }))} /></div>
        <table className="table-base">
          <thead><tr><th>Profesional</th><th className="num">Particular</th><th className="num">Por seguro</th><th className="num">Total</th><th className="w-[34%]">Distribución</th></tr></thead>
          <tbody>
            {(data ?? []).filter((d) => d.active || stats[d.id]).map((d) => {
              const s = stats[d.id] ?? { particular: 0, seguro: 0 };
              const t = s.particular + s.seguro;
              const pp = t ? Math.round((s.particular / t) * 100) : 0;
              return (
                <tr key={d.id}>
                  <td><Link href={`/medicos/${d.id}`} className="font-medium text-slate-900 hover:text-primary-700">{d.full_name}</Link></td>
                  <td className="num">{s.particular}</td>
                  <td className="num">{s.seguro}</td>
                  <td className="num font-semibold text-slate-900">{t}</td>
                  <td>
                    {t === 0 ? <span className="text-xs text-slate-400">Sin atenciones en el período</span> : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-2.5 flex-1 gap-[2px] overflow-hidden rounded-full bg-slate-100">
                          {s.particular > 0 && <div className="rounded-l-full bg-[#eb6834]" style={{ width: `${pp}%` }} title={`Particular: ${s.particular}`} />}
                          {s.seguro > 0 && <div className="rounded-r-full bg-[#2563eb]" style={{ width: `${100 - pp}%` }} title={`Seguro: ${s.seguro}`} />}
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-500">{pp}% · {100 - pp}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="flex items-center gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#eb6834]" /> Particular</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> Por seguro</span>
          <span className="ml-auto">Cuenta las citas marcadas como “Atendida”.</span>
        </p>
      </Card>

      <Card padded={false} title="Profesionales">
        {!data?.length ? <EmptyState title="Sin profesionales" /> : (
          <table className="table-base">
            <thead><tr><th>Profesional</th><th>Matrícula</th><th>Especialidades</th><th>Consultorio</th><th>Horarios</th><th>Contacto</th><th>Estado</th></tr></thead>
            <tbody>
              {data.map((d) => {
                const specs = (d.doctor_specialties as unknown as { specialties: { name: string } }[]).map((x) => x.specialties.name);
                const days = Array.from(new Set((d.doctor_schedules as { weekday: number }[]).map((s) => s.weekday))).sort();
                return (
                  <tr key={d.id}>
                    <td><Link href={`/medicos/${d.id}`} className="font-medium text-slate-900 hover:text-primary-700">{d.full_name}</Link></td>
                    <td>{d.license_number}</td>
                    <td><div className="flex flex-wrap gap-1">{specs.map((s) => <Badge key={s} tone="sky">{s}</Badge>)}</div></td>
                    <td>{(d.rooms as unknown as { name: string } | null)?.name ?? "—"}</td>
                    <td className="text-xs text-slate-500">{days.length ? days.map((w) => WEEKDAYS[w].slice(0, 3)).join(", ") : "Sin horarios"}</td>
                    <td className="text-xs">{d.phone}<br />{d.email}</td>
                    <td>{d.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
