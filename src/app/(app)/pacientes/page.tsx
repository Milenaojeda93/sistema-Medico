import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { age, fmtDate } from "@/lib/utils";

export const metadata = { title: "Pacientes" };

export default async function Patients({ searchParams }: { searchParams: Promise<{ q?: string; archivados?: string; page?: string }> }) {
  const ctx = await guard("pacientes");
  const { q, archivados, page } = await searchParams;
  const pageN = Math.max(1, Number(page ?? 1));
  const size = 25;
  let query = ctx.supabase.from("patients")
    .select("id, first_name, last_name, document, birth_date, phone, city, archived, created_at, patient_insurances(status, end_date, insurers(trade_name))", { count: "exact" })
    .eq("clinic_id", ctx.clinic.id).eq("archived", archivados === "1")
    .order("last_name").range((pageN - 1) * size, pageN * size - 1);
  if (q) {
    const t = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,document.ilike.%${t.replace(/\./g, "")}%,phone.ilike.%${t}%`);
  }
  const { data, count } = await query;
  const pages = Math.ceil((count ?? 0) / size);
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(archivados ? { archivados } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Pacientes" description={`${count ?? 0} ${archivados === "1" ? "archivados" : "registrados"}`}
        actions={can(ctx.perms, "pacientes", "create") && <LinkButton href="/pacientes/nuevo"><Plus className="h-4 w-4" /> Nuevo paciente</LinkButton>} />
      <Card padded={false}>
        <form className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Buscar por nombre, documento o teléfono" className="input pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="archivados" value="1" defaultChecked={archivados === "1"} className="rounded border-slate-300" /> Ver archivados
          </label>
          <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Buscar</button>
        </form>
        {!data?.length ? (
          <EmptyState title="No se encontraron pacientes" description={q ? "Probá con otro término de búsqueda." : "Registrá el primer paciente de la institución."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Teléfono</th><th>Ciudad</th><th>Cobertura</th><th>Alta</th></tr></thead>
              <tbody>
                {data.map((p) => {
                  const ins = (p.patient_insurances as unknown as { status: string; end_date: string | null; insurers: { trade_name: string } | null }[]) ?? [];
                  const active = ins.find((i) => i.status === "activo" && (!i.end_date || i.end_date >= new Date().toISOString().slice(0, 10)));
                  return (
                    <tr key={p.id}>
                      <td><Link href={`/pacientes/${p.id}`} className="font-medium text-slate-900 hover:text-primary-700">{p.last_name}, {p.first_name}</Link></td>
                      <td className="tabular-nums">{p.document}</td>
                      <td>{age(p.birth_date) ?? "—"}</td>
                      <td>{p.phone ?? "—"}</td>
                      <td>{p.city ?? "—"}</td>
                      <td>{active ? <Badge tone="blue">{active.insurers?.trade_name}</Badge> : ins.length ? <Badge tone="red">Sin cobertura activa</Badge> : <Badge>Particular</Badge>}</td>
                      <td className="text-slate-500">{fmtDate(p.created_at, ctx.tz)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Página {pageN} de {pages}</span>
            <div className="flex gap-2">
              {pageN > 1 && <LinkButton variant="secondary" size="sm" href={qs(pageN - 1)}>Anterior</LinkButton>}
              {pageN < pages && <LinkButton variant="secondary" size="sm" href={qs(pageN + 1)}>Siguiente</LinkButton>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
