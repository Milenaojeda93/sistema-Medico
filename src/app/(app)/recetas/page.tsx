import Link from "next/link";
import { Printer } from "lucide-react";
import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Recetas médicas" };

export default async function Prescriptions({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const ctx = await guard("recetas");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  let query = ctx.supabase.from("prescriptions")
    .select("id, number, issued_at, status, diagnosis, consultation_id, patients!inner(id, first_name, last_name, document), doctors(full_name), prescription_items(drug)")
    .eq("clinic_id", ctx.clinic.id).order("issued_at", { ascending: false }).limit(200);
  if (sp.estado === "emitida" || sp.estado === "anulada") query = query.eq("status", sp.estado);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = /^\d+$/.test(safe) ? query.ilike("patients.document", `%${safe}%`) : query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`, { referencedTable: "patients" });
  }
  const { data } = await query;
  type Row = { id: string; number: string; issued_at: string; status: string; diagnosis: string | null; consultation_id: string | null; patients: { id: string; first_name: string; last_name: string; document: string }; doctors: { full_name: string }; prescription_items: { drug: string }[] };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Recetas médicas" description="Todas las recetas emitidas en la institución" />
      <div className="mb-4"><Notice tone="blue">Las recetas se emiten desde la <b>consulta</b>: abrí la consulta del paciente y usá la sección <b>Receta médica</b>, sin cambiar de pantalla.</Notice></div>
      <Card padded={false}>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input name="q" defaultValue={q} placeholder="Buscar por paciente o documento…" className="input max-w-sm" />
          <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto">
            <option value="">Todas</option><option value="emitida">Emitidas</option><option value="anulada">Anuladas</option>
          </select>
          <button className="inline-flex h-9 items-center rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Filtrar</button>
        </form>
        {!rows.length ? <EmptyState title="Sin recetas" description="Cuando un médico emita una receta desde la consulta, aparecerá acá." /> : (
          <table className="table-base">
            <thead><tr><th>Receta</th><th>Fecha</th><th>Paciente</th><th>Profesional</th><th>Medicamentos</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/recetas/${r.id}`} className="font-medium text-slate-900 hover:text-primary-700">{r.number}</Link></td>
                  <td className="text-xs">{fmtDateTime(r.issued_at, ctx.tz)}</td>
                  <td><Link href={`/pacientes/${r.patients.id}?tab=recetas`} className="hover:text-primary-700">{r.patients.last_name}, {r.patients.first_name}</Link><p className="text-xs text-slate-500">CI {r.patients.document}</p></td>
                  <td>{r.doctors.full_name}</td>
                  <td className="max-w-xs truncate text-xs text-slate-600">{r.prescription_items.map((i) => i.drug).join(", ")}</td>
                  <td>{r.status === "anulada" ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Emitida</Badge>}</td>
                  <td className="text-right">{r.status !== "anulada" && <Link href={`/recetas/${r.id}?imprimir=1`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"><Printer className="h-3.5 w-3.5" /> Imprimir</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
