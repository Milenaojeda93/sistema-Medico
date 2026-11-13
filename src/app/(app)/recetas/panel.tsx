import Link from "next/link";
import { Printer } from "lucide-react";
import type { Ctx } from "@/lib/context";
import { can } from "@/lib/context";
import { Badge, Card } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { PrescriptionBuilder, type PrevRx } from "./builder";
import type { RxItem } from "./actions";

const COMMON = ["Paracetamol", "Ibuprofeno", "Amoxicilina", "Amoxicilina + Ácido clavulánico", "Azitromicina", "Omeprazol", "Loratadina", "Diclofenac", "Metformina", "Losartán", "Enalapril", "Amlodipina", "Atorvastatina", "Salbutamol", "Prednisona", "Dipirona", "Ketorolac", "Cetirizina", "Ciprofloxacina", "Levotiroxina"];

type Rx = { id: string; number: string; issued_at: string; status: string; prescription_items: (RxItem & { position: number })[] };

export async function PrescriptionPanel({ ctx, patientId, doctorId, consultationId, diagnosis, allergies, readOnly = false }: {
  ctx: Ctx; patientId: string; doctorId: string; consultationId: string; diagnosis: string | null; allergies: string | null; readOnly?: boolean;
}) {
  if (!can(ctx.perms, "recetas")) return null;
  const sel = "id, number, issued_at, status, prescription_items(drug, presentation, dose, frequency, duration, quantity, route, instructions, position)";
  const [{ data: mine }, { data: prev }, { data: used }] = await Promise.all([
    ctx.supabase.from("prescriptions").select(sel).eq("clinic_id", ctx.clinic.id).eq("consultation_id", consultationId).order("issued_at"),
    ctx.supabase.from("prescriptions").select(sel).eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).eq("status", "emitida").order("issued_at", { ascending: false }).limit(10),
    ctx.supabase.from("prescription_items").select("drug").eq("clinic_id", ctx.clinic.id).limit(1000),
  ]);
  const suggestions = Array.from(new Set([...(used ?? []).map((u) => u.drug), ...COMMON])).sort((a, b) => a.localeCompare(b, "es"));
  const sortItems = (r: Rx) => [...r.prescription_items].sort((a, b) => a.position - b.position);
  const previous: PrevRx[] = ((prev ?? []) as unknown as Rx[]).map((r) => ({ id: r.id, number: r.number, issued_at: r.issued_at, items: sortItems(r) }));
  const list = (mine ?? []) as unknown as Rx[];

  return (
    <Card title={`Receta médica${list.length ? ` (${list.length})` : ""}`}>
      {list.length > 0 && (
        <ul className="mb-5 space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`rounded-2xl border p-4 ${r.status === "anulada" ? "border-slate-200 bg-slate-50 opacity-70" : "border-primary-100 bg-primary-50/30"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{r.number}</span>
                <span className="text-xs text-slate-500">{fmtDateTime(r.issued_at, ctx.tz)}</span>
                {r.status === "anulada" ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Emitida</Badge>}
                <Link href={`/recetas/${r.id}`} className="ml-auto text-xs font-medium text-slate-600 hover:text-primary-700">Ver detalle</Link>
                {r.status !== "anulada" && (
                  <Link href={`/recetas/${r.id}?imprimir=1`} target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-primary-700 shadow-soft ring-1 ring-primary-200 hover:bg-primary-50">
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </Link>
                )}
              </div>
              <ol className="space-y-1 text-sm text-slate-700">
                {sortItems(r).map((i, n) => (
                  <li key={n}><b className="text-slate-900">{i.drug}</b>{i.presentation ? ` ${i.presentation}` : ""}{[i.dose, i.frequency, i.duration].filter(Boolean).length ? ` — ${[i.dose, i.frequency, i.duration].filter(Boolean).join(", ")}` : ""}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
      {can(ctx.perms, "recetas", "create") && !readOnly ? (
        <PrescriptionBuilder patientId={patientId} doctorId={doctorId} consultationId={consultationId} defaultDiagnosis={diagnosis ?? ""}
          allergies={allergies} suggestions={suggestions} previous={previous} />
      ) : !list.length && <p className="text-sm text-slate-500">Sin recetas en esta consulta.</p>}
    </Card>
  );
}
