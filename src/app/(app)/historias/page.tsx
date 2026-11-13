import Link from "next/link";
import { realAllergies } from "@/lib/constants";
import { Search } from "lucide-react";
import { guard } from "@/lib/context";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { age, fmtDate } from "@/lib/utils";

export const metadata = { title: "Historias clínicas" };

export default async function ClinicalRecords({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await guard("historias");
  const { q } = await searchParams;
  let query = ctx.supabase.from("patients")
    .select("id, first_name, last_name, document, birth_date, allergies, consultations(consulted_at, diagnosis, status)")
    .eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(100);
  if (q) {
    const t = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,document.ilike.%${t}%`);
  }
  const { data } = await query;
  const rows = (data ?? []).map((p) => {
    const cons = ((p.consultations as { consulted_at: string; diagnosis: string | null; status: string }[]) ?? []).sort((a, b) => b.consulted_at.localeCompare(a.consulted_at));
    return { ...p, total: cons.length, last: cons[0], open: cons.filter((c) => c.status === "abierta").length };
  });

  return (
    <>
      <PageHeader title="Historias clínicas" description="Historia clínica electrónica centralizada por paciente" />
      <Card padded={false}>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Buscar paciente por nombre o documento" className="input pl-9" />
          </div>
        </form>
        {!rows.length ? <EmptyState title="Sin resultados" /> : (
          <table className="table-base">
            <thead><tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Consultas</th><th>Última atención</th><th>Último diagnóstico</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link className="font-medium hover:text-primary-700" href={`/pacientes/${p.id}?tab=historia`}>{p.last_name}, {p.first_name}</Link>
                    {realAllergies(p.allergies) && <span className="ml-2 rounded bg-red-50 px-1.5 text-[11px] text-red-700">Alergias</span>}
                    {p.open > 0 && <span className="ml-2 rounded bg-amber-50 px-1.5 text-[11px] text-amber-700">{p.open} abierta(s)</span>}</td>
                  <td>{p.document}</td><td>{age(p.birth_date) ?? "—"}</td><td>{p.total}</td>
                  <td>{p.last ? fmtDate(p.last.consulted_at, ctx.tz) : "—"}</td>
                  <td className="max-w-64 truncate">{p.last?.diagnosis ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
