import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { WEEKDAYS } from "@/lib/constants";

export const metadata = { title: "Médicos y profesionales" };

export default async function Doctors() {
  const ctx = await guard("medicos");
  const { data } = await ctx.supabase.from("doctors")
    .select("id, full_name, license_number, phone, email, active, rooms(name), doctor_specialties(specialties(name)), doctor_schedules(weekday, start_time, end_time)")
    .eq("clinic_id", ctx.clinic.id).order("active", { ascending: false }).order("full_name");
  return (
    <>
      <PageHeader title="Médicos y profesionales" description={`${data?.filter((d) => d.active).length ?? 0} activos`}
        actions={can(ctx.perms, "medicos", "create") && <LinkButton href="/medicos/nuevo"><Plus className="h-4 w-4" /> Nuevo profesional</LinkButton>} />
      <Card padded={false}>
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
