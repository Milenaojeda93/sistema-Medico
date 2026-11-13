import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { AUTH_STATUS } from "@/lib/constants";
import { fmtDate, todayISO } from "@/lib/utils";
import { NewAuthorizationForm } from "./new-form";
import { updateAuthorization } from "./actions";

export const metadata = { title: "Autorizaciones" };

export default async function Authorizations({ searchParams }: { searchParams: Promise<{ estado?: string; aseguradora?: string; nueva?: string; paciente?: string }> }) {
  const ctx = await guard("autorizaciones");
  const sp = await searchParams;
  let q = ctx.supabase.from("authorizations")
    .select("*, patients(first_name, last_name, document), doctors(full_name), patient_insurances!inner(insurer_id, member_number, insurers(trade_name), insurance_plans(name))")
    .eq("clinic_id", ctx.clinic.id).order("request_date", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (sp.estado === "abiertas") q = q.in("status", ["pendiente", "en_revision"]);
  else if (sp.estado) q = q.eq("status", sp.estado);
  if (sp.aseguradora) q = q.eq("patient_insurances.insurer_id", sp.aseguradora);

  const canCreate = can(ctx.perms, "autorizaciones", "create");
  const [{ data }, { data: insurers }, form] = await Promise.all([
    q,
    ctx.supabase.from("insurers").select("id, trade_name").eq("clinic_id", ctx.clinic.id).order("trade_name"),
    canCreate ? Promise.all([
      ctx.supabase.from("patients").select("id, first_name, last_name, document").eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(5000),
      ctx.supabase.from("v_patient_insurances").select("id, patient_id, insurer_name, plan_name, member_number, effective_status").eq("clinic_id", ctx.clinic.id),
      ctx.supabase.from("services").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
      ctx.supabase.from("doctors").select("id, full_name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("full_name"),
    ]) : Promise.resolve(null),
  ]);
  const insuredIds = new Set((form?.[1].data ?? []).map((i) => i.patient_id));
  const editable = can(ctx.perms, "autorizaciones", "edit");

  return (
    <>
      <PageHeader title="Autorizaciones" description="Solicitudes de autorización a aseguradoras y su seguimiento"
        actions={form && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nueva solicitud</>} title="Solicitar autorización" size="lg">
            <NewAuthorizationForm today={todayISO(ctx.tz)} defaultPatient={sp.paciente}
              patients={(form[0].data ?? []).filter((p) => insuredIds.has(p.id)).map((p) => ({ id: p.id, name: `${p.last_name}, ${p.first_name} — ${p.document}` }))}
              insurances={form[1].data ?? []} services={form[2].data ?? []} doctors={form[3].data ?? []} />
          </Modal>
        )} />
      <Card padded={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto">
            <option value="">Todos los estados</option><option value="abiertas">Abiertas (pendiente / en revisión)</option>
            {Object.entries(AUTH_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select name="aseguradora" defaultValue={sp.aseguradora ?? ""} className="input w-auto"><option value="">Todas las aseguradoras</option>{insurers?.map((i) => <option key={i.id} value={i.id}>{i.trade_name}</option>)}</select>
          <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Filtrar</button>
        </form>
        {!data?.length ? <EmptyState title="Sin autorizaciones" /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Solicitud</th><th>Paciente</th><th>Aseguradora / plan</th><th>Servicio</th><th>Profesional</th><th>Respuesta</th><th>N° autorización</th><th>Estado</th><th></th></tr></thead>
              <tbody>{data.map((a) => {
                const p = a.patients as { first_name: string; last_name: string; document: string };
                const pi = a.patient_insurances as unknown as { member_number: string; insurers: { trade_name: string }; insurance_plans: { name: string } };
                return (
                  <tr key={a.id}>
                    <td>{fmtDate(a.request_date)}<p className="text-xs text-slate-500">{a.request_number ?? ""}</p></td>
                    <td><Link href={`/pacientes/${a.patient_id}?tab=seguros`} className="font-medium hover:text-primary-700">{p.last_name}, {p.first_name}</Link></td>
                    <td>{pi.insurers.trade_name}<p className="text-xs text-slate-500">{pi.insurance_plans.name} · {pi.member_number}</p></td>
                    <td>{a.service_description}</td>
                    <td>{(a.doctors as { full_name: string } | null)?.full_name ?? "—"}</td>
                    <td>{fmtDate(a.response_date)}{a.valid_until && <p className="text-xs text-slate-500">Vence {fmtDate(a.valid_until)}</p>}</td>
                    <td className="tabular-nums">{a.authorization_number ?? "—"}</td>
                    <td><StatusBadge map={AUTH_STATUS} value={a.status} /></td>
                    <td className="text-right">{editable && (
                      <Modal trigger="Actualizar" title="Actualizar autorización" triggerVariant="ghost" triggerSize="sm" size="sm">
                        <ActionForm action={updateAuthorization.bind(null, a.id)} className="space-y-4">
                          <p className="text-sm text-slate-600">{a.service_description} · {p.first_name} {p.last_name}</p>
                          <Field label="Estado" name="status"><Select name="status" defaultValue={a.status}>{Object.entries(AUTH_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Fecha de respuesta" name="response_date"><Input type="date" name="response_date" defaultValue={a.response_date ?? todayISO(ctx.tz)} /></Field>
                            <Field label="Válida hasta" name="valid_until"><Input type="date" name="valid_until" defaultValue={a.valid_until ?? ""} /></Field>
                          </div>
                          <Field label="Número de autorización" name="authorization_number"><Input name="authorization_number" defaultValue={a.authorization_number ?? ""} /></Field>
                          <Field label="Observaciones" name="notes"><Textarea name="notes" rows={2} defaultValue={a.notes ?? ""} /></Field>
                          <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                        </ActionForm>
                      </Modal>
                    )}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
