import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { CATEGORIES } from "@/lib/constants";
import { gs } from "@/lib/utils";
import { deleteCoverage, saveCoverage, updatePlan } from "../../../actions";

type Cov = { id: string; category: string; specialty_id: string | null; covered: boolean; coverage_percent: number; copay: number; max_amount: number | null; annual_quantity_limit: number | null; requires_authorization: boolean; notes: string | null; specialties: { name: string } | null };

function CoverageFields({ c, specialties }: { c?: Cov; specialties: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Categoría de prestación" name="category" required>
        <Select name="category" defaultValue={c?.category ?? ""} required><option value="">Seleccioná…</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </Field>
      <Field label="Especialidad (opcional)" name="specialty_id" hint="Vacío = aplica a todas">
        <Select name="specialty_id" defaultValue={c?.specialty_id ?? ""}><option value="">Todas</option>{specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </Field>
      <Field label="Porcentaje de cobertura (%)" name="coverage_percent"><Input name="coverage_percent" type="number" min={0} max={100} step="0.01" defaultValue={c ? Number(c.coverage_percent) : 80} /></Field>
      <Field label="Copago por prestación (Gs.)" name="copay" hint="Monto fijo a cargo del paciente"><Input name="copay" type="number" min={0} defaultValue={c ? Number(c.copay) : 0} /></Field>
      <Field label="Tope cubierto por prestación (Gs.)" name="max_amount" hint="Opcional"><Input name="max_amount" type="number" min={0} defaultValue={c?.max_amount ?? ""} /></Field>
      <Field label="Cantidad anual disponible" name="annual_quantity_limit" hint="Opcional, ej.: 12 consultas por año"><Input name="annual_quantity_limit" type="number" min={0} defaultValue={c?.annual_quantity_limit ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="covered" defaultChecked={c ? c.covered : true} className="rounded border-slate-300" /> Prestación cubierta (desmarcar = excluida)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_authorization" defaultChecked={c?.requires_authorization} className="rounded border-slate-300" /> Requiere autorización previa</label>
      <Field label="Notas" name="notes" className="sm:col-span-2"><Textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} /></Field>
    </div>
  );
}

export default async function PlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  const ctx = await guard("aseguradoras");
  const [{ data: plan }, { data: covs }, { data: specialties }] = await Promise.all([
    ctx.supabase.from("insurance_plans").select("*, insurers(trade_name)").eq("id", planId).eq("insurer_id", id).maybeSingle(),
    ctx.supabase.from("plan_coverages").select("*, specialties(name)").eq("plan_id", planId).order("category"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
  ]);
  if (!plan) notFound();
  const editable = can(ctx.perms, "aseguradoras", "edit");
  const list = (covs ?? []) as unknown as Cov[];
  const configured = new Set(list.map((c) => c.category));

  return (
    <>
      <PageHeader title={`${(plan.insurers as { trade_name: string }).trade_name} · ${plan.name}`} description="Reglas de cobertura configurables por categoría y especialidad" back={{ href: `/aseguradoras/${id}`, label: "Aseguradora" }} />
      <div className="mb-6"><Notice>
        El sistema <b>no asume cobertura</b>: si una categoría no tiene regla, la prestación se factura al paciente. Si la regla exige autorización, sólo se aplica la cobertura cuando existe una autorización aprobada y vigente. Cálculo: paciente = copago + (precio − copago) × (100 − %) ; aseguradora = resto, limitado por el tope.
      </Notice></div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Coberturas" padded={false} className="xl:col-span-2" actions={editable && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Agregar regla</>} title="Nueva regla de cobertura" triggerSize="sm" size="lg">
            <ActionForm action={saveCoverage.bind(null, planId, null)}><CoverageFields specialties={specialties ?? []} /><div className="mt-5 flex justify-end"><SubmitButton>Guardar regla</SubmitButton></div></ActionForm>
          </Modal>
        )}>
          {!list.length ? <EmptyState title="Sin coberturas configuradas" description="Agregá una regla por cada tipo de prestación que cubre el plan." /> : (
            <table className="table-base">
              <thead><tr><th>Prestación</th><th>Cobertura</th><th>Copago</th><th>Tope</th><th>Límite anual</th><th>Autorización</th><th></th></tr></thead>
              <tbody>{list.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{CATEGORIES[c.category]}<p className="text-xs font-normal text-slate-500">{c.specialties?.name ?? "Todas las especialidades"}</p></td>
                  <td>{c.covered ? <Badge tone="blue">{Number(c.coverage_percent)}%</Badge> : <Badge tone="red">Excluida</Badge>}</td>
                  <td className="tabular-nums">{Number(c.copay) ? gs(c.copay) : "—"}</td>
                  <td className="tabular-nums">{c.max_amount ? gs(c.max_amount) : "—"}</td>
                  <td>{c.annual_quantity_limit ?? "Sin límite"}</td>
                  <td>{c.requires_authorization ? <Badge tone="amber">Requerida</Badge> : "No"}</td>
                  <td className="text-right">
                    {editable && (
                      <div className="flex justify-end gap-1">
                        <Modal trigger="Editar" title={`Editar regla · ${CATEGORIES[c.category]}`} triggerVariant="ghost" triggerSize="sm" size="lg">
                          <ActionForm action={saveCoverage.bind(null, planId, c.id)}><CoverageFields c={c} specialties={specialties ?? []} /><div className="mt-5 flex justify-end"><SubmitButton>Guardar</SubmitButton></div></ActionForm>
                        </Modal>
                        <ActionButton action={deleteCoverage.bind(null, c.id)} variant="ghost" confirm="¿Eliminar esta regla? La categoría dejará de estar cubierta."><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                      </div>
                    )}
                  </td>
                </tr>))}</tbody>
            </table>
          )}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Sin regla (no cubiertas): {Object.entries(CATEGORIES).filter(([k]) => !configured.has(k)).map(([, v]) => v).join(", ") || "ninguna"}
          </div>
        </Card>
        <Card title="Datos del plan">
          <ActionForm action={updatePlan.bind(null, planId)} className="space-y-4">
            <fieldset disabled={!editable} className="space-y-4">
              <Field label="Nombre" name="name" required><Input name="name" defaultValue={plan.name} required /></Field>
              <Field label="Deducible anual (Gs.)" name="deductible" hint="Informativo: se muestra al facturar"><Input name="deductible" type="number" defaultValue={Number(plan.deductible)} /></Field>
              <Field label="Límite de cobertura anual (Gs.)" name="annual_limit" hint="Informativo en esta versión"><Input name="annual_limit" type="number" defaultValue={plan.annual_limit ?? ""} /></Field>
              <Field label="Notas" name="notes"><Textarea name="notes" defaultValue={plan.notes ?? ""} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={plan.active} className="rounded border-slate-300" /> Plan activo</label>
            </fieldset>
            {editable && <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>}
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
