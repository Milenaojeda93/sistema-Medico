import { redirect } from "next/navigation";
import { guard } from "@/lib/context";
import { Card, Field, Input, Notice, PageHeader } from "@/components/ui";
import { CLINICAL_SUGGESTIONS as CS } from "@/lib/constants";
import { ConsultaPickers } from "../header-pickers";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { ArrowRight } from "lucide-react";
import { age } from "@/lib/utils";
import { createConsultation } from "../actions";

export const metadata = { title: "Nueva consulta" };

export default async function NewConsultation({ searchParams }: { searchParams: Promise<{ cita?: string; paciente?: string }> }) {
  const ctx = await guard("historias", "create");
  const sp = await searchParams;
  const { data: appt } = sp.cita
    ? await ctx.supabase.from("appointments").select("id, patient_id, doctor_id, specialty_id, reason").eq("id", sp.cita).eq("clinic_id", ctx.clinic.id).maybeSingle()
    : { data: null };
  if (appt) {
    // Si la cita ya tiene una consulta abierta, se retoma.
    const { data: open } = await ctx.supabase.from("consultations").select("id").eq("appointment_id", appt.id).eq("status", "abierta").limit(1).maybeSingle();
    if (open) redirect(`/consultas/${open.id}`);
  }
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
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Motivo de consulta" name="reason" required className="md:col-span-3">
              <Input name="reason" defaultValue={appt?.reason ?? ""} required placeholder="Ej.: Dolor de garganta y fiebre" />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">En la pantalla siguiente cargás los signos vitales, el diagnóstico, la receta y los estudios.</p>
            <SubmitButton className="h-11 px-5 text-base">Empezar consulta <ArrowRight className="h-5 w-5" /></SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
