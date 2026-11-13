import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { CATEGORIES } from "@/lib/constants";
import { gs } from "@/lib/utils";
import { InsurerFields } from "../fields";
import { createPlan, updateInsurer } from "../actions";

export default async function InsurerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("aseguradoras");
  const [{ data: i }, { data: plans }] = await Promise.all([
    ctx.supabase.from("insurers").select("*").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle(),
    ctx.supabase.from("insurance_plans").select("id, name, deductible, annual_limit, active, plan_coverages(category, covered, coverage_percent, requires_authorization), patient_insurances(id)").eq("insurer_id", id).order("name"),
  ]);
  if (!i) notFound();
  const editable = can(ctx.perms, "aseguradoras", "edit");
  return (
    <>
      <PageHeader title={i.trade_name} description={i.legal_name ?? undefined} back={{ href: "/aseguradoras", label: "Aseguradoras" }} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Planes médicos" padded={false} className="xl:col-span-3" actions={can(ctx.perms, "aseguradoras", "create") && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nuevo plan</>} title="Nuevo plan" triggerSize="sm" size="sm">
            <ActionForm action={createPlan.bind(null, id)} className="space-y-4">
              <Field label="Nombre del plan" name="name" required><Input name="name" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deducible anual (Gs.)" name="deductible"><Input name="deductible" type="number" defaultValue={0} /></Field>
                <Field label="Límite anual (Gs.)" name="annual_limit"><Input name="annual_limit" type="number" /></Field>
              </div>
              <Field label="Notas" name="notes"><Textarea name="notes" rows={2} /></Field>
              <div className="flex justify-end"><SubmitButton>Crear y configurar coberturas</SubmitButton></div>
            </ActionForm>
          </Modal>
        )}>
          {!plans?.length ? <EmptyState title="Sin planes" description="Creá un plan y configurá qué cubre." /> : (
            <ul className="divide-y divide-slate-100">
              {plans.map((p) => {
                const covs = p.plan_coverages as { category: string; covered: boolean; coverage_percent: number; requires_authorization: boolean }[];
                return (
                  <li key={p.id}>
                    <Link href={`/aseguradoras/${id}/planes/${p.id}`} className="block px-5 py-4 hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <div className="flex gap-2">{!p.active && <Badge>Inactivo</Badge>}<span className="text-xs text-slate-500">{(p.patient_insurances as unknown[]).length} afiliados</span></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {covs.length === 0 && <span className="text-xs text-amber-600">Sin coberturas configuradas: ninguna prestación se considerará cubierta</span>}
                        {covs.map((c) => (
                          <Badge key={c.category} tone={c.covered ? "blue" : "gray"}>
                            {CATEGORIES[c.category]} {c.covered ? `${Number(c.coverage_percent)}%` : "excluido"}{c.requires_authorization ? " · autoriz." : ""}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Deducible {gs(p.deductible)} · Límite anual {p.annual_limit ? gs(p.annual_limit) : "sin límite"}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Datos de la aseguradora" className="xl:col-span-2">
          <ActionForm action={updateInsurer.bind(null, id)}>
            <fieldset disabled={!editable}>
              <InsurerFields i={i} />
              <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={i.active} className="rounded border-slate-300" /> Convenio activo</label>
            </fieldset>
            {editable && <div className="mt-5 flex justify-end"><SubmitButton>Guardar</SubmitButton></div>}
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
