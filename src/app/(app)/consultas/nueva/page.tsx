import { guard } from "@/lib/context";
import { Card, Notice, PageHeader } from "@/components/ui";
import { CLINICAL_SUGGESTIONS as CS } from "@/lib/constants";
import { ConsultaPickers } from "../header-pickers";
import { FinishBar } from "../finish-bar";
import { ActionForm } from "@/components/ui/client";
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
    ctx.supabase.from("doctors").select("id, full_name, user_id, doctor_specialties(specialty_id)").eq("clinic_id", ctx.clinic.id).eq("active", true).order("full_name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    patientId ? ctx.supabase.from("patients").select("id, first_name, last_name, document, birth_date, allergies, preexisting_conditions, current_medications").eq("id", patientId).maybeSingle() : Promise.resolve({ data: null }),
    patientId ? Promise.resolve({ data: [] }) : ctx.supabase.from("patients").select("id, first_name, last_name, document").eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(3000),
  ]);
  const real = (v: string | null | undefined, none: string) => (v && v.trim().toLowerCase() !== none.toLowerCase() ? v : null);
  const alert = patient ? { a: real(patient.allergies, CS.allergies.none), p: real(patient.preexisting_conditions, CS.preexisting_conditions.none), m: real(patient.current_medications, CS.current_medications.none) } : null;
  const myDoctor = doctors?.find((d) => d.user_id === ctx.user.id);
  const doctorList = ctx.ownOnly ? (doctors ?? []).filter((d) => ctx.myDoctorIds.includes(d.id)) : doctors;

  return (
    <>
      <PageHeader title="Nueva consulta" description={patient ? `${patient.first_name} ${patient.last_name} · CI ${patient.document}${patient.birth_date ? ` · ${age(patient.birth_date)} años` : ""}` : "Registro en la historia clínica"} back={{ href: "/consultas", label: "Consultas" }} />
      {alert && (alert.a || alert.p || alert.m) && (
        <div className="mb-4"><Notice tone="amber">
          {alert.a && <><b>Alergias:</b> {alert.a}. </>}
          {alert.p && <><b>Preexistentes:</b> {alert.p}. </>}
          {alert.m && <><b>Medicación:</b> {alert.m}.</>}
        </Notice></div>
      )}
      <Card>
        <ActionForm action={createConsultation}>
          <input type="hidden" name="appointment_id" value={appt?.id ?? ""} />
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {patient && <input type="hidden" name="patient_id" value={patient.id} />}
            <ConsultaPickers
              patients={patient ? null : (patients ?? []).map((p) => ({ value: p.id, label: `${p.last_name}, ${p.first_name}`, hint: `CI ${p.document}` }))}
              doctors={(doctorList ?? []).map((d) => ({ id: d.id, full_name: d.full_name, specialties: ((d.doctor_specialties ?? []) as { specialty_id: string }[]).map((x) => x.specialty_id) }))}
              specialties={specialties ?? []}
              defaultDoctor={appt?.doctor_id ?? myDoctor?.id ?? ""}
              defaultSpecialty={appt?.specialty_id ?? ""}
            />
          </div>
          <ClinicalFields c={{ reason: appt?.reason ?? "" }} />
          <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ¿Necesitás receta o estudios? Tocá <b>Guardar y seguir</b> y se habilitan abajo. Cuando termines, <b>Finalizar atención</b> deja al paciente como atendido.
          </p>
          <FinishBar patient={patient ? `${patient.first_name} ${patient.last_name}` : "Nueva consulta"} draftLabel="Guardar y seguir" />
        </ActionForm>
      </Card>
    </>
  );
}
