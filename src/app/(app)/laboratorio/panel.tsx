import type { Ctx } from "@/lib/context";
import { can } from "@/lib/context";
import { Card } from "@/components/ui";
import { LabOrderBuilder } from "./builder";
import { LAB_SELECT, LabOrderCard, signedUrls, type LabOrderRow } from "./order-card";

export async function LabPanel({ ctx, patientId, doctorId, consultationId }: { ctx: Ctx; patientId: string; doctorId: string; consultationId: string }) {
  if (!can(ctx.perms, "laboratorio")) return null;
  const [{ data: mine }, { data: prev }] = await Promise.all([
    ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("consultation_id", consultationId).order("ordered_at"),
    ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).eq("status", "completado")
      .neq("consultation_id", consultationId).order("ordered_at", { ascending: false }).limit(3),
  ]);
  const list = (mine ?? []) as unknown as LabOrderRow[];
  const previous = (prev ?? []) as unknown as LabOrderRow[];
  const urls = await signedUrls(ctx, [...list, ...previous]);
  return (
    <Card title={`Estudios y laboratorio${list.length ? ` (${list.length})` : ""}`}>
      {list.length > 0 && <div className="mb-5 space-y-3">{list.map((o) => <LabOrderCard key={o.id} o={o} tz={ctx.tz} urls={urls} />)}</div>}
      {can(ctx.perms, "laboratorio", "create") ? <LabOrderBuilder patientId={patientId} doctorId={doctorId} consultationId={consultationId} />
        : !list.length && <p className="text-sm text-slate-500">Sin estudios pedidos en esta consulta.</p>}
      {previous.length > 0 && (
        <details className="mt-5 rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Resultados anteriores del paciente ({previous.length})</summary>
          <div className="mt-3 space-y-3">{previous.map((o) => <LabOrderCard key={o.id} o={o} tz={ctx.tz} urls={urls} showDoctor />)}</div>
        </details>
      )}
    </Card>
  );
}
