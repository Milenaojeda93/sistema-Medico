import Link from "next/link";
import { realAllergies } from "@/lib/constants";
import { notFound } from "next/navigation";
import { FlaskConical, Lock, Pill, Receipt } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, DL, Field, Input, LinkButton, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { age, fmtDateTime } from "@/lib/utils";
import { ClinicalFields } from "../clinical-fields";
import { FinishBar } from "../finish-bar";
import { amendConsultation, updateConsultation } from "../actions";
import { PrescriptionPanel } from "../../recetas/panel";
import { LabPanel } from "../../laboratorio/panel";

const FIELDS: Record<string, string> = {
  reason: "Motivo de consulta", symptoms: "Síntomas", background: "Antecedentes", diagnosis: "Diagnóstico", diagnosis_code: "Código CIE-10",
  observations: "Observaciones", treatment: "Tratamiento", instructions: "Indicaciones", evolution: "Evolución médica",
};

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("historias");
  const { data: c } = await ctx.supabase.from("consultations")
    .select("*, patients(id, first_name, last_name, document, birth_date, allergies), doctors(full_name, license_number), specialties(name)")
    .eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!c) notFound();
  const [{ data: amendments }, { data: people }, { data: invoice }, { count: rxCount0 }, { count: labCount0 }] = await Promise.all([
    ctx.supabase.from("consultation_amendments").select("*").eq("consultation_id", id).order("created_at"),
    ctx.supabase.from("profiles").select("id, full_name"),
    can(ctx.perms, "facturacion") ? ctx.supabase.from("invoices").select("id, number").eq("consultation_id", id).neq("status", "anulada").maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("consultation_id", id),
    ctx.supabase.from("lab_orders").select("id", { count: "exact", head: true }).eq("consultation_id", id),
  ]);
  const rxCount = rxCount0 ?? 0, labCount = labCount0 ?? 0;
  const who = (uid: string | null) => people?.find((p) => p.id === uid)?.full_name ?? "—";
  const p = c.patients as { id: string; first_name: string; last_name: string; document: string; birth_date: string | null; allergies: string | null };
  const d = c.doctors as { full_name: string; license_number: string };
  const closed = c.status === "cerrada";
  const mine = !ctx.ownOnly || ctx.myDoctorIds.includes(c.doctor_id);
  const canEdit = can(ctx.perms, "historias", "edit") && mine;

  return (
    <>
      <PageHeader
        back={{ href: `/pacientes/${p.id}?tab=historia`, label: "Historia clínica del paciente" }}
        title={<span className="flex items-center gap-3">Consulta · {p.first_name} {p.last_name} {closed ? <Badge><Lock className="h-3 w-3" /> Cerrada</Badge> : <Badge tone="amber">Abierta</Badge>}</span>}
        description={`${fmtDateTime(c.consulted_at, ctx.tz)} · ${d.full_name} (Mat. ${d.license_number})${c.specialties ? " · " + (c.specialties as { name: string }).name : ""} · CI ${p.document}${p.birth_date ? ` · ${age(p.birth_date)} años` : ""}`}
        actions={
          <>
            {can(ctx.perms, "recetas") && <a href="#receta" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50"><Pill className="h-4 w-4" /> Receta</a>}
            {can(ctx.perms, "laboratorio") && <a href="#estudios" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-sm font-medium text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50"><FlaskConical className="h-4 w-4" /> Estudios</a>}
            {invoice ? <LinkButton variant="secondary" href={`/facturacion/${invoice.id}`}><Receipt className="h-4 w-4" /> Factura {invoice.number}</LinkButton>
              : can(ctx.perms, "facturacion", "create") && <LinkButton variant="secondary" href={`/facturacion/nueva?paciente=${p.id}&consulta=${id}`}><Receipt className="h-4 w-4" /> Facturar</LinkButton>}
          </>
        }
      />
      {realAllergies(p.allergies) && <div className="mb-4"><Notice tone="red"><b>Alergias:</b> {p.allergies}</Notice></div>}
      {!mine && <div className="mb-4"><Notice tone="blue">Consulta realizada por <b>{d.full_name}</b>. Podés verla como parte de la historia clínica compartida, pero solo quien la atendió puede modificarla.</Notice></div>}

      {!closed && canEdit ? (
        <Card>
          <ActionForm action={updateConsultation.bind(null, id)}>
            <ClinicalFields c={c} />
            <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">Creada por {who(c.created_by)} · última modificación {fmtDateTime(c.updated_at, ctx.tz)}</p>
            <FinishBar patient={`${p.first_name} ${p.last_name}`} checks={[
              { label: "Diagnóstico", done: !!(c.diagnosis ?? "").trim() },
              ...(can(ctx.perms, "recetas") ? [{ label: rxCount ? `Receta (${rxCount})` : "Receta", done: rxCount > 0, href: "#receta" }] : []),
              ...(can(ctx.perms, "laboratorio") ? [{ label: labCount ? `Estudios (${labCount})` : "Estudios", done: labCount > 0, href: "#estudios" }] : []),
            ]} />
          </ActionForm>
        </Card>
      ) : null}
      {!closed && canEdit && <div className="mt-6"><div id="receta" className="scroll-mt-24"><PrescriptionPanel ctx={ctx} patientId={p.id} doctorId={c.doctor_id} consultationId={id} diagnosis={c.diagnosis} allergies={realAllergies(p.allergies)} readOnly={!mine} /></div></div>}
      {!closed && canEdit && <div className="mt-6"><div id="estudios" className="scroll-mt-24"><LabPanel ctx={ctx} patientId={p.id} doctorId={c.doctor_id} consultationId={id} readOnly={!mine} /></div></div>}
      {!closed && canEdit ? null : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Registro clínico">
              <DL cols={2} items={[["Motivo de consulta", c.reason], ["Síntomas", c.symptoms], ["Antecedentes", c.background], ["Observaciones", c.observations]]} />
            </Card>
            <Card title="Signos vitales">
              <DL cols={4} items={[
                ["Presión arterial", c.bp_systolic ? `${c.bp_systolic}/${c.bp_diastolic} mmHg` : null], ["Temperatura", c.temperature ? `${c.temperature} °C` : null],
                ["Frecuencia cardíaca", c.heart_rate ? `${c.heart_rate} lpm` : null], ["Frecuencia respiratoria", c.respiratory_rate ? `${c.respiratory_rate} rpm` : null],
                ["Saturación O₂", c.oxygen_saturation ? `${c.oxygen_saturation}%` : null], ["Peso", c.weight_kg ? `${c.weight_kg} kg` : null],
                ["Altura", c.height_cm ? `${c.height_cm} cm` : null], ["IMC", c.weight_kg && c.height_cm ? (c.weight_kg / (c.height_cm / 100) ** 2).toFixed(1) : null],
              ]} />
            </Card>
            <Card title="Diagnóstico y plan">
              <DL cols={2} items={[["Diagnóstico", c.diagnosis ? `${c.diagnosis}${c.diagnosis_code ? ` (${c.diagnosis_code})` : ""}` : null], ["Tratamiento", c.treatment], ["Indicaciones", c.instructions], ["Evolución médica", c.evolution]]} />
            </Card>
            <div id="receta" className="scroll-mt-24"><PrescriptionPanel ctx={ctx} patientId={p.id} doctorId={c.doctor_id} consultationId={id} diagnosis={c.diagnosis} allergies={realAllergies(p.allergies)} readOnly={!mine} /></div>
            <div id="estudios" className="scroll-mt-24"><LabPanel ctx={ctx} patientId={p.id} doctorId={c.doctor_id} consultationId={id} readOnly={!mine} /></div>
          </div>
          <div className="space-y-6">
            <Card title="Trazabilidad">
              <DL cols={2} items={[["Creada por", who(c.created_by)], ["Fecha de atención", fmtDateTime(c.consulted_at, ctx.tz)], ["Cerrada por", who(c.closed_by)], ["Fecha de cierre", fmtDateTime(c.closed_at, ctx.tz)]]} />
              {closed && <p className="mt-4 text-xs text-slate-500">La historia cerrada es inmutable. Toda corrección queda registrada como enmienda con autor, fecha, valor anterior y motivo.</p>}
            </Card>
            <Card title={`Enmiendas (${amendments?.length ?? 0})`} actions={closed && canEdit && (
              <Modal trigger="Registrar enmienda" title="Registrar enmienda" triggerSize="sm" triggerVariant="secondary">
                <ActionForm action={amendConsultation.bind(null, id)} className="space-y-4">
                  <Field label="Campo a corregir" name="field" required>
                    <Select name="field" required>{Object.entries(FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                  </Field>
                  <Field label="Nuevo valor" name="value" required><Textarea name="value" required /></Field>
                  <Field label="Motivo de la enmienda" name="reason" required><Input name="reason" required placeholder="Ej.: error de transcripción" /></Field>
                  <div className="flex justify-end"><SubmitButton>Registrar enmienda</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}>
              {!amendments?.length ? <p className="text-sm text-slate-500">Sin enmiendas.</p> : (
                <ol className="space-y-4">
                  {amendments.map((a) => (
                    <li key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-800">{FIELDS[a.field] ?? a.field}</p>
                      <p className="mt-1 text-xs text-slate-500 line-through">{a.old_value ?? "(vacío)"}</p>
                      <p className="text-slate-700">{a.new_value}</p>
                      <p className="mt-1 text-xs text-slate-500">Motivo: {a.reason} · {who(a.created_by)} · {fmtDateTime(a.created_at, ctx.tz)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Link href={`/pacientes/${p.id}?tab=historia`} className="block text-center text-sm text-primary-600 hover:underline">Ver historia clínica completa</Link>
          </div>
        </div>
      )}
    </>
  );
}
