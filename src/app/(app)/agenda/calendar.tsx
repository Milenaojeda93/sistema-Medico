"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, ShieldCheck, Wallet, X, Stethoscope, User } from "lucide-react";
import { btnClass, Field, Input, Select, Textarea, StatusBadge } from "@/components/ui";
import { SubmitButton, type ActionState } from "@/components/ui/client";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { addDays, cn, fmtTime, gs, isoDate, toLocalInput, zonedParts } from "@/lib/utils";
import { DoctorCards, PatientPicker, SpecialtyChips } from "./pickers";
import { getDoctorBusy, saveAppointment, setAppointmentStatus, type Busy } from "./actions";

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; care_type: string; reason: string | null; notes: string | null;
  patient_id: string; doctor_id: string; specialty_id: string | null; room_id: string | null; patient_insurance_id: string | null;
  patients: { first_name: string; last_name: string; document: string; phone: string | null };
  doctors: { full_name: string }; specialties: { name: string } | null; rooms: { name: string } | null;
  patient_insurances: { member_number: string; insurers: { trade_name: string }; insurance_plans: { name: string } } | null;
};
type Doctor = { id: string; full_name: string; room_id: string | null; specialties: string[]; fee: number | null };
type Opt = { id: string; name: string };
type Ins = { id: string; patient_id: string; plan_id: string; insurer_name: string; plan_name: string; member_number: string; effective_status: string };
type Cov = { plan_id: string; specialty_id: string | null; covered: boolean; coverage_percent: number; copay: number; max_amount: number | null; requires_authorization: boolean };
type Sched = { doctor_id: string; weekday: number; start_time: string; end_time: string };

type Props = {
  view: "dia" | "semana" | "mes"; date: string; from: string; today: string; tz: string; doctorFilter: string;
  appointments: Appt[]; doctors: Doctor[]; rooms: Opt[]; specialties: Opt[];
  patients: { id: string; name: string; document: string; phone: string | null }[]; insurances: Ins[]; schedules: Sched[];
  consultPrices: { specialty_id: string | null; price: number }[]; coverages: Cov[];
  canCreate: boolean; canEdit: boolean; canConsult: boolean; openNewFor: string | null;
};

const START_H = 7, END_H = 21, HOUR_PX = 56;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STATUS_BAR: Record<string, string> = { pendiente: "border-l-amber-500", confirmada: "border-l-primary-600", en_espera: "border-l-violet-500", en_atencion: "border-l-sky-500", atendida: "border-l-green-600", cancelada: "border-l-slate-300", ausente: "border-l-red-500" };

export function Calendar(props: Props) {
  const { view, date, from, today, tz, doctorFilter, appointments, doctors } = props;
  const router = useRouter();
  const [selected, setSelected] = useState<Appt | null>(null);
  const [form, setForm] = useState<{ appt?: Appt; start?: string; doctorId?: string; patientId?: string; key: number } | null>(null);

  useEffect(() => {
    if (props.openNewFor !== null && props.canCreate) setForm({ patientId: props.openNewFor || undefined, start: `${today}T08:00`, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const href = (o: Partial<{ vista: string; fecha: string; medico: string }>) => {
    const p = new URLSearchParams({ vista: view, fecha: date, ...(doctorFilter ? { medico: doctorFilter } : {}), ...o });
    if (!p.get("medico")) p.delete("medico");
    return `/agenda?${p}`;
  };
  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const prev = view === "mes" ? shiftMonth(date, -1) : addDays(date, -step);
  const next = view === "mes" ? shiftMonth(date, 1) : addDays(date, step);

  const byDay = useMemo(() => {
    const m: Record<string, Appt[]> = {};
    for (const a of appointments) {
      const p = zonedParts(new Date(a.starts_at), tz);
      const k = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
      (m[k] ??= []).push(a);
    }
    return m;
  }, [appointments, tz]);

  const title = (() => {
    const [y, mo, d] = date.split("-").map(Number);
    if (view === "mes") return `${cap(MONTHS[mo - 1])} ${y}`;
    if (view === "dia") return `${DAY_NAMES[(new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7]} ${d} de ${MONTHS[mo - 1]} ${y}`;
    const end = addDays(from, 6);
    return `${Number(from.slice(8))} ${MONTHS[Number(from.slice(5, 7)) - 1].slice(0, 3)} – ${Number(end.slice(8))} ${MONTHS[Number(end.slice(5, 7)) - 1].slice(0, 3)} ${end.slice(0, 4)}`;
  })();

  const openNew = (start: string, doctorId?: string) => props.canCreate && setForm({ start, doctorId: doctorId ?? (doctorFilter || undefined), key: Date.now() });

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <div className="flex items-center gap-1">
          <Link href={href({ fecha: prev })} className={btnClass("secondary", "sm")} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={href({ fecha: today })} className={btnClass("secondary", "sm")}>Hoy</Link>
          <Link href={href({ fecha: next })} className={btnClass("secondary", "sm")} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5" value={doctorFilter} onChange={(e) => router.push(href({ medico: e.target.value }))}>
            <option value="">Todos los profesionales</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(["dia", "semana", "mes"] as const).map((v) => (
              <Link key={v} href={href({ vista: v })} className={cn("rounded-md px-3 py-1 text-xs font-medium", view === v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800")}>
                {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
              </Link>
            ))}
          </div>
          {props.canCreate && <button className={btnClass("primary", "sm")} onClick={() => openNew(`${date}T08:00`)}><Plus className="h-4 w-4" /> Nueva cita</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded bg-primary-50 ring-1 ring-primary-200"><ShieldCheck className="h-3 w-3 text-primary-600" /></span> Por seguro</span>
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded bg-orange-50 ring-1 ring-orange-200"><Wallet className="h-3 w-3 text-orange-600" /></span> Particular</span>
        <span className="text-slate-300">|</span>
        {Object.entries(APPOINTMENT_STATUS).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className={cn("h-3 w-1 rounded-full border-l-4", STATUS_BAR[k])} />{v.label}</span>)}
      </div>

      {view === "mes" ? (
        <MonthGrid from={from} date={date} today={today} byDay={byDay} tz={tz} onSelect={setSelected} onNew={(d) => openNew(`${d}T08:00`)} dayHref={(d) => href({ vista: "dia", fecha: d })} />
      ) : (
        <TimeGrid
          columns={view === "semana"
            ? Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { key: d, date: d, label: `${DAY_NAMES[i]} ${Number(d.slice(8))}`, appts: byDay[d] ?? [], doctorId: doctorFilter || undefined }; })
            : (doctorFilter ? doctors.filter((d) => d.id === doctorFilter) : doctors).map((d) => ({ key: d.id, date, label: d.full_name, appts: (byDay[date] ?? []).filter((a) => a.doctor_id === d.id), doctorId: d.id }))}
          today={today} tz={tz} schedules={props.schedules} onSelect={setSelected} onNew={openNew}
        />
      )}

      {selected && (
        <Dialog title="Detalle de la cita" onClose={() => setSelected(null)}>
          <AppointmentDetail a={selected} {...props}
            onEdit={() => { setForm({ appt: selected, key: Date.now() }); setSelected(null); }}
            onDone={() => { setSelected(null); router.refresh(); }} />
        </Dialog>
      )}
      {form && (
        <Dialog title={form.appt ? "Editar cita" : "Nueva cita"} onClose={() => setForm(null)} wide>
          <AppointmentForm key={form.key} {...props} appt={form.appt} start={form.start} doctorId={form.doctorId} patientId={form.patientId} onDone={() => { setForm(null); router.refresh(); }} />
        </Dialog>
      )}
    </div>
  );
}

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }
function shiftMonth(iso: string, n: number) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}
function minutesOf(iso: string, tz: string) { const p = zonedParts(new Date(iso), tz); return p.hour * 60 + p.minute; }

function TimeGrid({ columns, today, tz, schedules, onSelect, onNew }: {
  columns: { key: string; date: string; label: string; appts: Appt[]; doctorId?: string }[]; today: string; tz: string; schedules: Sched[];
  onSelect: (a: Appt) => void; onNew: (start: string, doctorId?: string) => void;
}) {
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const nowP = zonedParts(new Date(), tz);
  const nowMin = nowP.hour * 60 + nowP.minute;
  if (!columns.length) return <p className="p-10 text-center text-sm text-slate-500">No hay profesionales activos.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(120px, 1fr))` }}>
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white" />
        {columns.map((c) => (
          <div key={c.key} className={cn("sticky top-0 z-10 truncate border-b border-l border-slate-100 bg-white px-2 py-2 text-center text-xs font-semibold", c.date === today && columns.length === 7 ? "text-primary-700" : "text-slate-600")}>{c.label}</div>
        ))}
        <div className="relative">
          {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[11px] text-slate-400 -translate-y-2">{String(h).padStart(2, "0")}:00</div>)}
        </div>
        {columns.map((c) => {
          const wd = new Date(c.date + "T12:00:00Z").getUTCDay();
          const sched = c.doctorId ? schedules.filter((s) => s.doctor_id === c.doctorId && s.weekday === wd) : null;
          const lanes = layoutLanes(c.appts, tz);
          return (
            <div key={c.key} className="relative border-l border-slate-100" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => [0, 30].map((m) => {
                const mins = h * 60 + m;
                const inSched = !sched || sched.some((s) => mins >= toMin(s.start_time) && mins < toMin(s.end_time));
                return (
                  <button key={`${h}-${m}`} type="button" onClick={() => onNew(`${c.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, c.doctorId)}
                    className={cn("block w-full border-slate-100 hover:bg-primary-50/60", m === 0 ? "border-t" : "border-t border-dashed border-slate-50", !inSched && "bg-slate-50/80")}
                    style={{ height: HOUR_PX / 2 }} aria-label={`Nueva cita ${h}:${m}`} />
                );
              }))}
              {c.date === today && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
                  <span className="absolute -left-1 -top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              )}
              {c.appts.map((a) => {
                const s = minutesOf(a.starts_at, tz), e = minutesOf(a.ends_at, tz);
                const top = ((s - START_H * 60) / 60) * HOUR_PX;
                const height = Math.max(22, ((e - s) / 60) * HOUR_PX - 2);
                const { lane, count } = lanes[a.id];
                const ins = a.care_type === "seguro";
                const off = ["cancelada", "ausente"].includes(a.status);
                return (
                  <button key={a.id} type="button" onClick={() => onSelect(a)}
                    className={cn("absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs ring-1 transition hover:z-30 hover:shadow-md",
                      ins ? "bg-primary-50 ring-primary-100" : "bg-orange-50 ring-orange-100", STATUS_BAR[a.status], off && "opacity-50")}
                    style={{ top, height, left: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)` }}>
                    <span className="flex items-center gap-1 font-semibold text-slate-800">
                      {ins ? <ShieldCheck className="h-3 w-3 shrink-0 text-primary-600" /> : <Wallet className="h-3 w-3 shrink-0 text-orange-600" />}
                      <span className={cn("truncate", off && "line-through")}>{a.patients.last_name}, {a.patients.first_name}</span>
                    </span>
                    <span className="block truncate text-slate-500">{fmtTime(a.starts_at, tz)} · {columns.length === 7 ? a.doctors.full_name : a.specialties?.name ?? a.reason ?? ""}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function layoutLanes(appts: Appt[], tz: string) {
  const sorted = [...appts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const res: Record<string, { lane: number; count: number }> = {};
  let cluster: Appt[] = []; let clusterEnd = -1; let laneEnds: number[] = [];
  const flush = () => { const n = laneEnds.length || 1; cluster.forEach((a) => (res[a.id].count = n)); cluster = []; laneEnds = []; };
  for (const a of sorted) {
    const s = minutesOf(a.starts_at, tz), e = minutesOf(a.ends_at, tz);
    if (s >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
    res[a.id] = { lane, count: 1 };
    cluster.push(a); clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return res;
}

function MonthGrid({ from, date, today, byDay, tz, onSelect, onNew, dayHref }: {
  from: string; date: string; today: string; byDay: Record<string, Appt[]>; tz: string;
  onSelect: (a: Appt) => void; onNew: (d: string) => void; dayHref: (d: string) => string;
}) {
  const month = date.slice(0, 7);
  return (
    <div className="grid grid-cols-7">
      {DAY_NAMES.map((d) => <div key={d} className="border-b border-slate-100 py-2 text-center text-xs font-semibold text-slate-500">{d}</div>)}
      {Array.from({ length: 42 }, (_, i) => {
        const d = addDays(from, i);
        const list = byDay[d] ?? [];
        return (
          <div key={d} className={cn("min-h-28 border-b border-l border-slate-100 p-1.5", d.slice(0, 7) !== month && "bg-slate-50/60")} onDoubleClick={() => onNew(d)}>
            <Link href={dayHref(d)} className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", d === today ? "bg-primary-600 font-semibold text-white" : d.slice(0, 7) === month ? "text-slate-700 hover:bg-slate-100" : "text-slate-400")}>{Number(d.slice(8))}</Link>
            <div className="space-y-0.5">
              {list.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => onSelect(a)} className={cn("flex w-full items-center gap-1 truncate rounded border-l-[3px] px-1 py-0.5 text-left text-[11px]", a.care_type === "seguro" ? "bg-primary-50" : "bg-orange-50", STATUS_BAR[a.status], ["cancelada", "ausente"].includes(a.status) && "opacity-50 line-through")}>
                  <span className="font-medium text-slate-600">{fmtTime(a.starts_at, tz)}</span> <span className="truncate">{a.patients.last_name}</span>
                </button>
              ))}
              {list.length > 3 && <Link href={dayHref(d)} className="block px-1 text-[11px] font-medium text-primary-600">+{list.length - 3} más</Link>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dialog({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button onClick={() => ref.current?.close()} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

function StatusButton({ id, status, label, variant, onDone }: { id: string; status: string; label: string; variant: "secondary" | "primary" | "danger" | "success"; onDone: () => void }) {
  const [state, action] = useActionState(setAppointmentStatus.bind(null, id, status), null as ActionState);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action}>
      <SubmitButton size="sm" variant={variant}>{label}</SubmitButton>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function AppointmentDetail({ a, tz, canEdit, canConsult, onEdit, onDone }: { a: Appt; tz: string; canEdit: boolean; canConsult: boolean; onEdit: () => void; onDone: () => void }) {
  const flow: Record<string, { s: string; l: string; v: "secondary" | "primary" | "danger" | "success" }[]> = {
    pendiente: [{ s: "confirmada", l: "Confirmar", v: "primary" }, { s: "cancelada", l: "Cancelar", v: "secondary" }],
    confirmada: [{ s: "en_espera", l: "Llegó (en espera)", v: "primary" }, { s: "ausente", l: "Ausente", v: "danger" }, { s: "cancelada", l: "Cancelar", v: "secondary" }],
    en_espera: [{ s: "en_atencion", l: "Pasar a atención", v: "primary" }, { s: "ausente", l: "Ausente", v: "danger" }],
    en_atencion: [{ s: "atendida", l: "Marcar atendida", v: "success" }],
    cancelada: [{ s: "pendiente", l: "Reactivar", v: "secondary" }],
    ausente: [{ s: "pendiente", l: "Reactivar", v: "secondary" }],
    atendida: [],
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">{a.patients.first_name} {a.patients.last_name}</p>
          <p className="text-sm text-slate-500">CI {a.patients.document}{a.patients.phone ? ` · ${a.patients.phone}` : ""}</p>
        </div>
        <StatusBadge map={APPOINTMENT_STATUS} value={a.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div><dt className="text-xs text-slate-500">Fecha y hora</dt><dd className="font-medium">{new Intl.DateTimeFormat("es-PY", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(a.starts_at))}, {fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}</dd></div>
        <div><dt className="text-xs text-slate-500">Profesional</dt><dd className="font-medium">{a.doctors.full_name}</dd></div>
        <div><dt className="text-xs text-slate-500">Especialidad</dt><dd>{a.specialties?.name ?? "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Consultorio</dt><dd>{a.rooms?.name ?? "—"}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-500">Tipo de atención</dt><dd>
          {a.care_type === "seguro" && a.patient_insurances
            ? <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary-600" /> {a.patient_insurances.insurers.trade_name} — {a.patient_insurances.insurance_plans.name} · Afiliado {a.patient_insurances.member_number}</span>
            : <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-orange-600" /> Particular</span>}
        </dd></div>
        {a.reason && <div className="col-span-2"><dt className="text-xs text-slate-500">Motivo</dt><dd>{a.reason}</dd></div>}
        {a.notes && <div className="col-span-2"><dt className="text-xs text-slate-500">Notas</dt><dd>{a.notes}</dd></div>}
      </dl>
      {canEdit && (flow[a.status] ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">{flow[a.status].map((f) => <StatusButton key={f.s} id={a.id} status={f.s} label={f.l} variant={f.v} onDone={onDone} />)}</div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Link href={`/pacientes/${a.patient_id}`} className={btnClass("secondary", "sm")}><User className="h-4 w-4" /> Ver paciente</Link>
        {canConsult && ["confirmada", "en_espera", "en_atencion"].includes(a.status) && <Link href={`/consultas/nueva?cita=${a.id}`} className={btnClass("success", "sm")}><Stethoscope className="h-4 w-4" /> Iniciar consulta</Link>}
        {canEdit && !["atendida"].includes(a.status) && <button onClick={onEdit} className={cn(btnClass("ghost", "sm"), "ml-auto")}>Editar / reprogramar</button>}
      </div>
    </div>
  );
}

const WD_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MON_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const LOOKAHEAD = 28;
function weekdayOf(iso: string) { return new Date(iso + "T12:00:00Z").getUTCDay(); }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }

function AppointmentForm({ appt, start, doctorId, patientId, doctors, rooms, specialties, patients, insurances, schedules, consultPrices, coverages, today, tz, onDone }: Props & { appt?: Appt; start?: string; doctorId?: string; patientId?: string; onDone: () => void }) {
  const [state, action] = useActionState(saveAppointment.bind(null, appt?.id ?? null), null as ActionState);
  const [pid, setPid] = useState(appt?.patient_id ?? patientId ?? "");
  const initialDoctor = doctors.find((d) => d.id === (appt?.doctor_id ?? doctorId));
  const [sid, setSid] = useState(appt?.specialty_id ?? initialDoctor?.specialties[0] ?? "");
  const [did, setDid] = useState(initialDoctor?.id ?? "");
  const [care, setCare] = useState(appt?.care_type ?? "particular");
  const initialLocal = appt ? toLocalInput(appt.starts_at, tz) : start ?? "";
  const [day, setDay] = useState(initialLocal.slice(0, 10));
  const [time, setTime] = useState(initialLocal.slice(11, 16));
  const [duration, setDuration] = useState(appt ? Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000) : 30);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [loading, startLoading] = useTransition();
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  const patIns = insurances.filter((i) => i.patient_id === pid);
  const activeIns = patIns.filter((i) => i.effective_status === "activo");
  const specDoctors = sid ? doctors.filter((d) => d.specialties.includes(sid)) : doctors;
  const doctor = doctors.find((d) => d.id === did);
  const docSched = schedules.filter((s) => s.doctor_id === did);
  const [insId, setInsId] = useState(appt?.patient_insurance_id ?? "");
  const ins = activeIns.find((i) => i.id === insId) ?? activeIns[0];

  // Costo: honorario del médico → precio de consulta de la especialidad → consulta general.
  const priceFor = (d: Doctor, spec = sid) => {
    if (d.fee != null) return d.fee;
    const specs = spec ? [spec] : d.specialties;
    const bySpec = consultPrices.find((c) => c.specialty_id && specs.includes(c.specialty_id));
    return bySpec?.price ?? consultPrices.find((c) => !c.specialty_id)?.price ?? null;
  };
  const price = doctor ? priceFor(doctor) : null;
  const estimate = useMemo(() => {
    if (care !== "seguro" || !ins || price == null) return null;
    const spec = sid || doctor?.specialties[0] || null;
    const plan = coverages.filter((c) => c.plan_id === ins.plan_id);
    const cov = plan.find((c) => c.specialty_id && c.specialty_id === spec) ?? plan.find((c) => !c.specialty_id);
    if (!cov) return { patient: price, insurer: 0, note: "El plan no contempla consultas: el paciente abona el total." };
    if (!cov.covered) return { patient: price, insurer: 0, note: "Consulta excluida por el plan: el paciente abona el total." };
    const copay = Math.min(price, cov.copay);
    let patient = copay + Math.round(((price - copay) * (100 - cov.coverage_percent)) / 100);
    let insurer = price - patient;
    if (cov.max_amount != null && insurer > cov.max_amount) { insurer = cov.max_amount; patient = price - insurer; }
    const parts = [`Cubre ${cov.coverage_percent}%`, copay > 0 ? `copago ${gs(copay)}` : ""].filter(Boolean).join(" + ");
    return { patient, insurer, note: parts + (cov.requires_authorization ? " · requiere autorización de la aseguradora" : "") };
  }, [care, ins, price, sid, doctor, coverages]);

  useEffect(() => { if (care === "seguro" && pid && activeIns.length === 0) setCare("particular"); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!did) { setBusy(null); return; }
    let alive = true;
    startLoading(async () => {
      let b: Busy[] = [];
      try { b = await getDoctorBusy(did, today, LOOKAHEAD + 1); } catch { b = []; }
      if (alive) setBusy(b.filter((x) => x.id !== appt?.id));
    });
    return () => { alive = false; };
  }, [did]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= LOOKAHEAD; i++) {
      const d = addDays(today, i);
      if (docSched.some((s) => s.weekday === weekdayOf(d))) out.push(d);
    }
    return out;
  }, [did, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const busyByDay = useMemo(() => {
    const m: Record<string, [number, number][]> = {};
    for (const b of busy ?? []) {
      const s = zonedParts(new Date(b.starts_at), tz), e = zonedParts(new Date(b.ends_at), tz);
      const key = isoDate(s.year, s.month, s.day);
      const endMin = isoDate(e.year, e.month, e.day) === key ? e.hour * 60 + e.minute : 24 * 60;
      (m[key] ??= []).push([s.hour * 60 + s.minute, endMin]);
    }
    return m;
  }, [busy, tz]);

  const nowP = zonedParts(new Date(), tz);
  const nowMin = nowP.hour * 60 + nowP.minute;
  const slotsFor = (d: string) => {
    const taken = busyByDay[d] ?? [];
    const out: { t: string; free: boolean }[] = [];
    for (const s of docSched.filter((x) => x.weekday === weekdayOf(d)).sort((a, b) => a.start_time.localeCompare(b.start_time))) {
      const a = toMin(s.start_time), b = toMin(s.end_time);
      for (let t = a; t + duration <= b; t += duration) {
        if (d === today && t <= nowMin) continue;
        out.push({ t: hhmm(t), free: !taken.some(([x, y]) => t < y && t + duration > x) });
      }
    }
    return out;
  };
  const freeCount = (d: string) => slotsFor(d).filter((s) => s.free).length;
  const slots = day ? slotsFor(day) : [];
  const useGrid = !!did && docSched.length > 0 && !manual;
  const startsAt = day && time ? `${day}T${time}` : "";

  const pickDoctor = (id: string) => { setDid(id); setTime(""); if (!appt) setDay(""); setManual(false); };
  const pickSpecialty = (id: string) => { setSid(id); if (did && id && !doctors.find((d) => d.id === did)?.specialties.includes(id)) pickDoctor(""); };

  return (
    <form action={action} className="space-y-5">
      <div>
        <p className="label">Paciente <span className="text-rose-500">*</span></p>
        <PatientPicker patients={patients} value={pid} onChange={setPid} />
      </div>

      <div className="space-y-3">
        <div>
          <p className="label">1. Especialidad</p>
          <SpecialtyChips specialties={specialties} value={sid} onChange={pickSpecialty} />
        </div>
        <div>
          <p className="label">2. Profesional <span className="text-rose-500">*</span> {specDoctors.length > 0 && <span className="font-normal text-slate-400">· {specDoctors.length} disponible{specDoctors.length === 1 ? "" : "s"}</span>}</p>
          <DoctorCards doctors={specDoctors} specialties={specialties} value={did} onChange={pickDoctor} priceFor={(d) => priceFor(d as Doctor)} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-800">3. Día y horario disponible</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Duración</label>
            <select name="duration" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setTime(""); }} className="input h-8 w-auto py-0 text-xs">
              {[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
        </div>

        {!did && <p className="py-6 text-center text-sm text-slate-500">Elegí un profesional para ver sus días y horarios libres.</p>}

        {did && docSched.length === 0 && !manual && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200/60">
            {doctor?.full_name} no tiene horarios de atención cargados. Configuralos en <Link href={`/medicos/${did}`} className="font-medium underline">su ficha</Link> o <button type="button" onClick={() => setManual(true)} className="font-medium underline">elegí la hora manualmente</button>.
          </p>
        )}

        {useGrid && (
          <>
            {loading && !busy ? <p className="py-6 text-center text-sm text-slate-500">Buscando horarios libres…</p> : (
              <>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d) => {
                    const n = freeCount(d);
                    const dt = new Date(d + "T12:00:00Z");
                    return (
                      <button type="button" key={d} disabled={n === 0} onClick={() => { setDay(d); setTime(""); }}
                        className={cn("flex w-[68px] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center transition",
                          d === day ? "border-primary-500 bg-primary-600 text-white shadow-soft" : n === 0 ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:border-primary-300")}>
                        <span className="text-[11px] font-medium uppercase">{d === today ? "Hoy" : WD_SHORT[dt.getUTCDay()]}</span>
                        <span className="text-lg font-semibold leading-tight">{dt.getUTCDate()}</span>
                        <span className="text-[10px] opacity-80">{MON_SHORT[dt.getUTCMonth()]}</span>
                        <span className={cn("mt-1 text-[10px] font-medium", d === day ? "text-primary-100" : n ? "text-emerald-600" : "")}>{n ? `${n} libres` : "Completo"}</span>
                      </button>
                    );
                  })}
                  {!days.length && <p className="text-sm text-slate-500">Sin días de atención en las próximas 4 semanas.</p>}
                </div>
                {day && (
                  slots.length === 0 ? <p className="mt-2 text-sm text-slate-500">No quedan horarios para este día.</p> : (
                    <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {slots.map((s) => (
                        <button type="button" key={s.t} disabled={!s.free} onClick={() => setTime(s.t)} title={s.free ? "Disponible" : "Ocupado"}
                          className={cn("rounded-lg border py-2 text-sm font-medium tabular-nums transition",
                            time === s.t ? "border-primary-600 bg-primary-600 text-white" : s.free ? "border-emerald-200 bg-white text-slate-800 hover:border-emerald-400 hover:bg-emerald-50" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through")}>
                          {s.t}
                        </button>
                      ))}
                    </div>
                  )
                )}
                {day && appt && time && !slots.some((s) => s.t === time) && (
                  <p className="mt-2 text-xs text-slate-500">Horario actual: {time} (fuera de la grilla). Elegí uno nuevo o dejalo así.</p>
                )}
              </>
            )}
            <button type="button" onClick={() => setManual(true)} className="mt-3 text-xs font-medium text-slate-500 hover:text-primary-700">Agendar fuera del horario habitual (sobreturno)</button>
          </>
        )}

        {did && manual && (
          <div className="space-y-2">
            <Input type="datetime-local" step={300} value={startsAt} onChange={(e) => { setDay(e.target.value.slice(0, 10)); setTime(e.target.value.slice(11, 16)); }} required />
            <p className="text-xs text-slate-500">El sistema igual impide superponer citas del mismo profesional o consultorio.</p>
            {docSched.length > 0 && <button type="button" onClick={() => setManual(false)} className="text-xs font-medium text-primary-600 hover:underline">Volver a horarios disponibles</button>}
          </div>
        )}

        <input type="hidden" name="starts_at" value={startsAt} />
        {startsAt && did && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
            <CalendarCheck className="h-4 w-4 text-primary-600" />
            <span><b>{new Intl.DateTimeFormat("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"))}</b>, {time} a {hhmm(toMin(time) + duration)} con {doctor?.full_name}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Consultorio" name="room_id">
          <Select name="room_id" key={`r-${did}`} defaultValue={appt?.room_id ?? doctor?.room_id ?? ""}>
            <option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Estado" name="status">
          <Select name="status" defaultValue={appt?.status ?? "pendiente"}>
            {Object.entries(APPOINTMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="label">Tipo de atención</p>
        <div className="flex gap-2">
          {["particular", "seguro"].map((c) => (
            <label key={c} className={cn("flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", care === c ? (c === "seguro" ? "border-primary-500 bg-primary-50" : "border-orange-400 bg-orange-50") : "border-slate-200")}>
              <input type="radio" name="care_type" value={c} checked={care === c} onChange={() => setCare(c)} disabled={c === "seguro" && activeIns.length === 0} />
              {c === "seguro" ? <><ShieldCheck className="h-4 w-4 text-primary-600" /> Por seguro médico</> : <><Wallet className="h-4 w-4 text-orange-600" /> Particular</>}
            </label>
          ))}
        </div>
        {pid && activeIns.length === 0 && <p className="mt-2 text-xs text-slate-500">{patIns.length ? "El paciente no tiene seguros con cobertura activa (vencidos o suspendidos)." : "El paciente no tiene seguros registrados."}</p>}
        {care === "seguro" && (
          <Field label="Aseguradora y plan" name="patient_insurance_id" required className="mt-3">
            <Select name="patient_insurance_id" value={ins?.id ?? ""} onChange={(e) => setInsId(e.target.value)} required>
              {activeIns.map((i) => <option key={i.id} value={i.id}>{i.insurer_name} — {i.plan_name} (afiliado {i.member_number})</option>)}
            </Select>
          </Field>
        )}
      </div>
      {doctor && (
        <div className={cn("rounded-2xl p-4 ring-1", care === "seguro" ? "bg-primary-50/50 ring-primary-100" : "bg-orange-50/60 ring-orange-100")}>
          {price == null ? (
            <p className="text-sm text-slate-600">
              {doctor.full_name} no tiene cargado el costo de la consulta. Cargalo en <Link href={`/medicos/${doctor.id}`} className="font-medium text-primary-700 underline">su ficha</Link>.
            </p>
          ) : care === "seguro" && estimate ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary-700">Paciente abona (estimado)</p>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">{gs(estimate.patient)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{estimate.note}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Consulta: <span className="tabular-nums text-slate-700">{gs(price)}</span></p>
                <p>Cubre {ins?.insurer_name}: <span className="tabular-nums text-slate-700">{gs(estimate.insurer)}</span></p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Costo de la consulta particular</p>
                <p className="text-xs text-slate-500">{doctor.full_name}{doctor.fee == null ? " · precio de lista de la especialidad" : ""}</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{gs(price)}</p>
            </div>
          )}
        </div>
      )}
      <Field label="Motivo de consulta" name="reason"><Input name="reason" defaultValue={appt?.reason ?? ""} /></Field>
      <Field label="Notas internas" name="notes"><Textarea name="notes" rows={2} defaultValue={appt?.notes ?? ""} /></Field>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{state.error}</p>}
      {!startsAt && did && <p className="text-right text-xs text-slate-500">Elegí día y horario para poder agendar.</p>}
      <div className="flex justify-end"><SubmitButton disabled={!startsAt}>{appt ? "Guardar cambios" : "Agendar cita"}</SubmitButton></div>
    </form>
  );
}
