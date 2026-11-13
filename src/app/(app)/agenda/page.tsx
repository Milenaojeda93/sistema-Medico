import { guard, can } from "@/lib/context";
import { Notice, PageHeader } from "@/components/ui";
import { addDays, todayISO, zonedToUtc } from "@/lib/utils";
import { Calendar } from "./calendar";

export const metadata = { title: "Agenda médica" };

function weekStart(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; medico?: string; nueva?: string; paciente?: string }> }) {
  const ctx = await guard("agenda");
  const sp = await searchParams;
  const view = (["dia", "semana", "mes"].includes(sp.vista ?? "") ? sp.vista : "semana") as "dia" | "semana" | "mes";
  const date = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayISO(ctx.tz);

  let from: string, to: string;
  if (view === "dia") { from = date; to = addDays(date, 1); }
  else if (view === "semana") { from = weekStart(date); to = addDays(from, 7); }
  else {
    const first = date.slice(0, 8) + "01";
    from = weekStart(first);
    to = addDays(from, 42);
  }

  let q = ctx.supabase.from("appointments")
    .select("id, starts_at, ends_at, status, care_type, reason, notes, patient_id, doctor_id, specialty_id, room_id, patient_insurance_id, patients(first_name, last_name, document, phone), doctors(full_name), specialties(name), rooms(name), patient_insurances(member_number, insurers(trade_name), insurance_plans(name))")
    .eq("clinic_id", ctx.clinic.id)
    .gte("starts_at", zonedToUtc(`${from}T00:00`, ctx.tz).toISOString())
    .lt("starts_at", zonedToUtc(`${to}T00:00`, ctx.tz).toISOString())
    .order("starts_at");
  if (sp.medico) q = q.eq("doctor_id", sp.medico);
  const docFilter = ctx.ownOnly ? (sp.medico && ctx.myDoctorIds.includes(sp.medico) ? sp.medico : ctx.myDoctorIds.length === 1 ? ctx.myDoctorIds[0] : "") : sp.medico ?? "";

  const [{ data: appts }, { data: doctors }, { data: rooms }, { data: specialties }, { data: patients }, { data: insurances }, { data: schedules }] = await Promise.all([
    q,
    ctx.supabase.from("doctors").select("id, full_name, room_id, doctor_specialties(specialty_id)").eq("clinic_id", ctx.clinic.id).eq("active", true).order("full_name"),
    ctx.supabase.from("rooms").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("patients").select("id, first_name, last_name, document").eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(5000),
    ctx.supabase.from("v_patient_insurances").select("id, patient_id, insurer_name, plan_name, member_number, effective_status").eq("clinic_id", ctx.clinic.id),
    ctx.supabase.from("doctor_schedules").select("doctor_id, weekday, start_time, end_time").eq("clinic_id", ctx.clinic.id),
  ]);

  return (
    <>
      <PageHeader title={ctx.ownOnly ? "Mi agenda" : "Agenda médica"} description={ctx.ownOnly ? "Tus citas y horarios de atención" : "Citas por profesional, sin superposición de horarios ni consultorios"} />
      {ctx.ownOnly && !ctx.myDoctorIds.length && <div className="mb-4"><Notice tone="amber">Tu usuario todavía no está vinculado a una ficha de profesional. Pedile al administrador que lo vincule en <b>Médicos y profesionales</b> para ver tu agenda.</Notice></div>}
      <Calendar
        view={view}
        date={date}
        from={from}
        today={todayISO(ctx.tz)}
        tz={ctx.tz}
        doctorFilter={docFilter}
        appointments={(appts ?? []) as never}
        doctors={(doctors ?? []).filter((d) => !ctx.ownOnly || ctx.myDoctorIds.includes(d.id)).map((d) => ({ id: d.id, full_name: d.full_name, room_id: d.room_id, specialties: (d.doctor_specialties as { specialty_id: string }[]).map((x) => x.specialty_id) }))}
        rooms={rooms ?? []}
        specialties={specialties ?? []}
        patients={(patients ?? []).map((p) => ({ id: p.id, name: `${p.last_name}, ${p.first_name}`, document: p.document }))}
        insurances={insurances ?? []}
        schedules={schedules ?? []}
        canCreate={can(ctx.perms, "agenda", "create")}
        canEdit={can(ctx.perms, "agenda", "edit")}
        canConsult={can(ctx.perms, "historias", "create")}
        openNewFor={sp.nueva ? sp.paciente ?? "" : null}
      />
    </>
  );
}
