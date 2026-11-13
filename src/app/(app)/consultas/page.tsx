import Link from "next/link";
import { Stethoscope, Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { addDays, fmtDateTime, fmtTime, todayISO, zonedToUtc } from "@/lib/utils";
import { setAppointmentStatus } from "../agenda/actions";

export const metadata = { title: "Consultas" };

export default async function Consultations({ searchParams }: { searchParams: Promise<{ fecha?: string; medico?: string }> }) {
  const ctx = await guard("consultas");
  const sp = await searchParams;
  const day = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayISO(ctx.tz);
  const clinical = can(ctx.perms, "historias");

  let aq = ctx.supabase.from("appointments")
    .select("id, starts_at, status, care_type, reason, patient_id, patients(first_name, last_name, document), doctors(full_name), specialties(name), consultations(id, status)")
    .eq("clinic_id", ctx.clinic.id)
    .gte("starts_at", zonedToUtc(`${day}T00:00`, ctx.tz).toISOString()).lt("starts_at", zonedToUtc(`${addDays(day, 1)}T00:00`, ctx.tz).toISOString())
    .neq("status", "cancelada").order("starts_at");
  if (sp.medico) aq = aq.eq("doctor_id", sp.medico);

  const [{ data: appts }, { data: doctors }, recent] = await Promise.all([
    aq,
    ctx.supabase.from("doctors").select("id, full_name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("full_name"),
    clinical
      ? ctx.supabase.from("consultations").select("id, consulted_at, status, diagnosis, patients(first_name, last_name), doctors(full_name)").eq("clinic_id", ctx.clinic.id).order("consulted_at", { ascending: false }).limit(15)
      : Promise.resolve({ data: null }),
  ]);
  const counts = (s: string[]) => (appts ?? []).filter((a) => s.includes(a.status)).length;

  return (
    <>
      <PageHeader title="Consultas" description="Flujo de atención del día: recepción, sala de espera y consultorio"
        actions={can(ctx.perms, "historias", "create") && <LinkButton href="/consultas/nueva"><Plus className="h-4 w-4" /> Consulta sin cita</LinkButton>} />
      <form className="mb-4 flex flex-wrap items-center gap-3">
        <input type="date" name="fecha" defaultValue={day} className="input w-auto" />
        <select name="medico" defaultValue={sp.medico ?? ""} className="input w-auto">
          <option value="">Todos los profesionales</option>
          {doctors?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
        <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Ver</button>
        <div className="ml-auto flex gap-2 text-sm">
          <Badge tone="blue">Por llegar: {counts(["pendiente", "confirmada"])}</Badge>
          <Badge tone="violet">En espera: {counts(["en_espera"])}</Badge>
          <Badge tone="sky">En atención: {counts(["en_atencion"])}</Badge>
          <Badge tone="green">Atendidos: {counts(["atendida"])}</Badge>
        </div>
      </form>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Pacientes del día" padded={false} className="xl:col-span-2">
          {!appts?.length ? <EmptyState title="No hay citas para este día" /> : (
            <table className="table-base">
              <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Tipo</th><th>Estado</th><th className="text-right">Acción</th></tr></thead>
              <tbody>
                {appts.map((a) => {
                  const p = a.patients as unknown as { first_name: string; last_name: string; document: string };
                  const cons = (a.consultations as unknown as { id: string; status: string }[])?.[0];
                  return (
                    <tr key={a.id}>
                      <td className="font-semibold tabular-nums">{fmtTime(a.starts_at, ctx.tz)}</td>
                      <td><Link href={`/pacientes/${a.patient_id}`} className="font-medium hover:text-primary-700">{p.last_name}, {p.first_name}</Link><p className="text-xs text-slate-500">{a.reason ?? ""}</p></td>
                      <td>{(a.doctors as unknown as { full_name: string }).full_name}<p className="text-xs text-slate-500">{(a.specialties as unknown as { name: string } | null)?.name}</p></td>
                      <td>{a.care_type === "seguro" ? <Badge tone="blue">Seguro</Badge> : <Badge>Particular</Badge>}</td>
                      <td><StatusBadge map={APPOINTMENT_STATUS} value={a.status} /></td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {can(ctx.perms, "agenda", "edit") && ["pendiente", "confirmada"].includes(a.status) && (
                            <ActionButton action={setAppointmentStatus.bind(null, a.id, "en_espera")}>Registrar llegada</ActionButton>
                          )}
                          {cons && clinical ? (
                            <LinkButton size="sm" variant="soft" href={`/consultas/${cons.id}`}>Ver consulta</LinkButton>
                          ) : can(ctx.perms, "historias", "create") && ["confirmada", "en_espera", "en_atencion"].includes(a.status) ? (
                            <LinkButton size="sm" variant="success" href={`/consultas/nueva?cita=${a.id}`}><Stethoscope className="h-3.5 w-3.5" /> Atender</LinkButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        {clinical && (
          <Card title="Últimas consultas registradas" padded={false}>
            <ul className="divide-y divide-slate-100">
              {(recent.data ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/consultas/${c.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{(c.patients as unknown as { last_name: string; first_name: string }).last_name}, {(c.patients as unknown as { first_name: string }).first_name}</p>
                      <Badge tone={c.status === "cerrada" ? "gray" : "amber"}>{c.status === "cerrada" ? "Cerrada" : "Abierta"}</Badge>
                    </div>
                    <p className="truncate text-xs text-slate-500">{fmtDateTime(c.consulted_at, ctx.tz)} · {(c.doctors as unknown as { full_name: string }).full_name}</p>
                    {c.diagnosis && <p className="truncate text-xs text-slate-600">{c.diagnosis}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
