import type { Ctx } from "@/lib/context";
import { can } from "@/lib/context";
import { Card } from "@/components/ui";
import { LabOrderBuilder } from "./builder";
import { LAB_SELECT, LabOrderCard, signedUrls, type LabOrderRow } from "./order-card";

export async function LabPanel({ ctx, patientId, doctorId, consultationId, readOnly = false }: { ctx: Ctx; patientId: string; doctorId: string; consultationId: string; readOnly?: boolean }) {
  if (!can(ctx.perms, "laboratorio")) return null;
  const [{ data: mine }, { data: prev }, { data: waiting }] = await Promise.all([
    ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("consultation_id", consultationId).order("ordered_at"),
    ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).eq("status", "completado")
      .neq("consultation_id", consultationId).order("ordered_at", { ascending: false }).limit(3),
    ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).eq("location", "externo")
      .in("status", ["solicitado", "en_proceso"]).or(`consultation_id.is.null,consultation_id.neq.${consultationId}`).order("ordered_at", { ascending: false }).limit(5),
  ]);
  const pendingExt = (waiting ?? []) as unknown as LabOrderRow[];
  const list = (mine ?? []) as unknown as LabOrderRow[];
  const previous = (prev ?? []) as unknown as LabOrderRow[];
  const urls = await signedUrls(ctx, [...list, ...previous, ...pendingExt]);
  const attach = !readOnly && (can(ctx.perms, "laboratorio", "edit") || can(ctx.perms, "historias", "edit"));
  return (
    <Card title={`Estudios y laboratorio${list.length ? ` (${list.length})` : ""}`}>
      {pendingExt.length > 0 && (
        <div className="mb-5 rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
          <p className="mb-2 text-sm font-medium text-amber-900">¿El paciente trajo resultados? Tiene {pendingExt.length === 1 ? "un estudio externo indicado" : `${pendingExt.length} estudios externos indicados`} antes:</p>
          <div className="space-y-3">{pendingExt.map((o) => <LabOrderCard key={o.id} o={o} tz={ctx.tz} urls={urls} showDoctor canAttach={attach} />)}</div>
        </div>
      )}
      {list.length > 0 && <div className="mb-5 space-y-3">{list.map((o) => <LabOrderCard key={o.id} o={o} tz={ctx.tz} urls={urls} canAttach={!readOnly && (can(ctx.perms, "laboratorio", "edit") || can(ctx.perms, "historias", "edit"))} />)}</div>}
      {can(ctx.perms, "laboratorio", "create") && !readOnly ? <LabOrderBuilder patientId={patientId} doctorId={doctorId} consultationId={consultationId} />
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
