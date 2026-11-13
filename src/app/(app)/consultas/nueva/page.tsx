import { guard } from "@/lib/context";
import { Card, Field, Notice, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { age } from "@/lib/utils";
import { ClinicalFields } from "../clinical-fields";
import { createConsultation } from "../actions";

export const metadata = { title: "Nueva consulta" };

export default async function NewConsultation({ searchParams }: { searchParams: Promise<{ cita?: string; paciente?: string }> }) {
  const ctx = await guard("historias", "create");
  const sp = await searchParams;
  const { data: appt } = sp.cita
    ? await ctx.supabase.from("appointments").select("id, patient_id, doctor_id, specialty_id, reason").eq("id", sp.cita).eq("clinic_id", ctx.clinic.id).maybeSingle()
    : { data: null };
  const patientId = appt?.patient_id ?? sp.paciente ?? "";

  const [{ data: doctors }, { data: specialties }, { data: patient }, { data: patients }] = await Promise.all([
    ctx.supabase.from("doctors").select("id, full_name, user_id").eq("clinic_id", ctx.clinic.id).eq("active", true).order("full_name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    patientId ? ctx.supabase.from("patients").select("id, first_name, last_name, document, birth_date, allergies, preexisting_conditions, current_medications").eq("id", patientId).maybeSingle() : Promise.resolve({ data: null }),
    patientId ? Promise.resolve({ data: [] }) : ctx.supabase.from("patients").select("id, first_name, last_name, document").eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(3000),
  ]);
  const myDoctor = doctors?.find((d) => d.user_id === ctx.user.id);
  const doctorList = ctx.ownOnly ? (doctors ?? []).filter((d) => ctx.myDoctorIds.includes(d.id)) : doctors;

  return (
    <>
      <PageHeader title="Nueva consulta" description={patient ? `${patient.first_name} ${patient.last_name} · CI ${patient.document}${patient.birth_date ? ` · ${age(patient.birth_date)} años` : ""}` : "Registro en la historia clínica"} back={{ href: "/consultas", label: "Consultas" }} />
      {patient && (patient.allergies || patient.preexisting_conditions || patient.current_medications) && (
        <div className="mb-4"><Notice tone="amber">
          {patient.allergies && <><b>Alergias:</b> {patient.allergies}. </>}
          {patient.preexisting_conditions && <><b>Preexistentes:</b> {patient.preexisting_conditions}. </>}
          {patient.current_medications && <><b>Medicación:</b> {patient.current_medications}.</>}
        </Notice></div>
      )}
      <Card>
        <ActionForm action={createConsultation}>
          <input type="hidden" name="appointment_id" value={appt?.id ?? ""} />
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {patient ? <input type="hidden" name="patient_id" value={patient.id} /> : (
              <Field label="Paciente" name="patient_id" required>
                <Select name="patient_id" required defaultValue="">
                  <option value="">Seleccioná…</option>
                  {patients?.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name} — {p.document}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Profesional responsable" name="doctor_id" required>
              <Select name="doctor_id" required defaultValue={appt?.doctor_id ?? myDoctor?.id ?? ""}>
                <option value="">Seleccioná…</option>
                {doctorList?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Especialidad" name="specialty_id">
              <Select name="specialty_id" defaultValue={appt?.specialty_id ?? ""}>
                <option value="">—</option>{specialties?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <ClinicalFields c={{ reason: appt?.reason ?? "" }} />
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <SubmitButton variant="secondary">Guardar borrador</SubmitButton>
            <SubmitButton name="close" value="1" confirm="Al cerrar la consulta ya no podrá editarse; las correcciones quedarán como enmiendas. ¿Continuar?">Guardar y cerrar consulta</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
