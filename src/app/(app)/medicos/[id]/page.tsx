import { notFound } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Card, Field, Input, Notice, PageHeader, Select } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/client";
import { WEEKDAYS } from "@/lib/constants";
import { DoctorFields } from "../fields";
import { addSchedule, deleteSchedule, saveDoctorInsurances, updateDoctor } from "../actions";
import { DoctorInsurancesEditor } from "../insurance-form";

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("medicos");
  const [{ data: d }, { data: rooms }, { data: specialties }, { data: schedules }, users] = await Promise.all([
    ctx.supabase.from("doctors").select("*, doctor_specialties(specialty_id)").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle(),
    ctx.supabase.from("rooms").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("doctor_schedules").select("id, weekday, start_time, end_time, rooms(name)").eq("doctor_id", id).order("weekday").order("start_time"),
    can(ctx.perms, "usuarios") ? ctx.supabase.rpc("clinic_users", { p_clinic: ctx.clinic.id }) : Promise.resolve({ data: [] }),
  ]);
  const [docIns, { data: insurers }, { data: plans }] = await Promise.all([
    ctx.supabase.from("doctor_insurances").select("insurer_id, plan_id, coverage_percent, copay").eq("doctor_id", id),
    ctx.supabase.from("insurers").select("id, trade_name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("trade_name"),
    ctx.supabase.from("insurance_plans").select("id, insurer_id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
  ]);
  type DI = { insurer_id: string; plan_id: string | null; coverage_percent: number | null; copay: number | null };
  const insList = (docIns.data ?? []) as unknown as DI[];
  const insMissing = !!docIns.error;
  if (!d) notFound();
  const editable = can(ctx.perms, "medicos", "edit");
  const selected = (d.doctor_specialties as { specialty_id: string }[]).map((x) => x.specialty_id);

  return (
    <>
      <PageHeader title={d.full_name} description={`Matrícula ${d.license_number}`} back={{ href: "/medicos", label: "Médicos" }} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Datos del profesional" className="xl:col-span-3">
          <ActionForm action={updateDoctor.bind(null, id)}>
            <fieldset disabled={!editable}>
              <DoctorFields d={d} rooms={rooms ?? []} specialties={specialties ?? []} selected={selected} users={users.data ?? []} />
              <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={d.active} className="rounded border-slate-300" /> Profesional activo</label>
            </fieldset>
            {editable && <div className="mt-6 flex justify-end"><SubmitButton>Guardar</SubmitButton></div>}
          </ActionForm>
        </Card>
        <Card title="Horarios de atención" className="xl:col-span-2">
          <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {!schedules?.length && <li className="p-3 text-sm text-slate-500">Sin horarios configurados.</li>}
            {schedules?.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><b className="font-medium">{WEEKDAYS[s.weekday]}</b> {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} <span className="text-slate-500">{(s.rooms as unknown as { name: string } | null)?.name ?? ""}</span></span>
                {editable && <ActionButton action={deleteSchedule.bind(null, s.id)} variant="ghost" confirm="¿Eliminar este horario?"><Trash2 className="h-3.5 w-3.5" /></ActionButton>}
              </li>
            ))}
          </ul>
          {editable && (
            <ActionForm action={addSchedule.bind(null, id)} resetOnSuccess className="space-y-3">
              <p className="label">Agregar horario</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w, i) => (
                  <label key={w} className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input type="checkbox" name="weekday" value={i} className="sr-only" /> {w.slice(0, 3)}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Desde" name="start_time"><Input type="time" name="start_time" defaultValue="08:00" required /></Field>
                <Field label="Hasta" name="end_time"><Input type="time" name="end_time" defaultValue="12:00" required /></Field>
                <Field label="Consultorio" name="room_id"><Select name="room_id" defaultValue={d.room_id ?? ""}><option value="">—</option>{rooms?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
              </div>
              <div className="flex justify-end"><SubmitButton size="sm">Agregar</SubmitButton></div>
            </ActionForm>
          )}
        </Card>
        <Card title="Seguros que atiende" className="xl:col-span-5" actions={<ShieldCheck className="h-4 w-4 text-primary-600" />}>
          {insMissing ? (
            <Notice tone="amber">Para usar esta sección falta aplicar la actualización <b>0012</b> en la base de datos.</Notice>
          ) : (
            <DoctorInsurancesEditor insurers={insurers ?? []} plans={plans ?? []} editable={editable}
              initial={insList.map((x) => ({ insurer_id: x.insurer_id, plan_id: x.plan_id, coverage_percent: x.coverage_percent, copay: x.copay }))}
              action={saveDoctorInsurances.bind(null, id)} />
          )}
        </Card>
      </div>
    </>
  );
}
