"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, ShieldCheck, Wallet, X, Stethoscope, User } from "lucide-react";
import { btnClass, Field, Input, Select, Textarea, StatusBadge } from "@/components/ui";
import { SubmitButton, type ActionState } from "@/components/ui/client";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { addDays, cn, fmtTime, toLocalInput, zonedParts } from "@/lib/utils";
import { saveAppointment, setAppointmentStatus } from "./actions";

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; care_type: string; reason: string | null; notes: string | null;
  patient_id: string; doctor_id: string; specialty_id: string | null; room_id: string | null; patient_insurance_id: string | null;
  patients: { first_name: string; last_name: string; document: string; phone: string | null };
  doctors: { full_name: string }; specialties: { name: string } | null; rooms: { name: string } | null;
  patient_insurances: { member_number: string; insurers: { trade_name: string }; insurance_plans: { name: string } } | null;
};
type Doctor = { id: string; full_name: string; room_id: string | null; specialties: string[] };
type Opt = { id: string; name: string };
type Ins = { id: string; patient_id: string; insurer_name: string; plan_name: string; member_number: string; effective_status: string };
type Sched = { doctor_id: string; weekday: number; start_time: string; end_time: string };

type Props = {
  view: "dia" | "semana" | "mes"; date: string; from: string; today: string; tz: string; doctorFilter: string;
  appointments: Appt[]; doctors: Doctor[]; rooms: Opt[]; specialties: Opt[];
  patients: { id: string; name: string; document: string }[]; insurances: Ins[]; schedules: Sched[];
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

function AppointmentForm({ appt, start, doctorId, patientId, doctors, rooms, specialties, patients, insurances, tz, onDone }: Props & { appt?: Appt; start?: string; doctorId?: string; patientId?: string; onDone: () => void }) {
  const [state, action] = useActionState(saveAppointment.bind(null, appt?.id ?? null), null as ActionState);
  const [search, setSearch] = useState("");
  const [pid, setPid] = useState(appt?.patient_id ?? patientId ?? "");
  const [did, setDid] = useState(appt?.doctor_id ?? doctorId ?? "");
  const [care, setCare] = useState(appt?.care_type ?? "particular");
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = t ? patients.filter((p) => p.name.toLowerCase().includes(t) || p.document.includes(t)) : patients;
    const sel = patients.find((p) => p.id === pid);
    return sel && !list.includes(sel) ? [sel, ...list.slice(0, 199)] : list.slice(0, 200);
  }, [search, patients, pid]);
  const patIns = insurances.filter((i) => i.patient_id === pid);
  const activeIns = patIns.filter((i) => i.effective_status === "activo");
  const doctor = doctors.find((d) => d.id === did);
  const docSpecs = specialties.filter((s) => !doctor || doctor.specialties.includes(s.id));
  const duration = appt ? Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000) : 30;

  useEffect(() => { if (care === "seguro" && pid && activeIns.length === 0) setCare("particular"); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={action} className="space-y-4">
      <Field label="Paciente" required>
        <input placeholder="Buscar por nombre o documento…" value={search} onChange={(e) => setSearch(e.target.value)} className="input mb-2" />
        <Select name="patient_id" value={pid} onChange={(e) => setPid(e.target.value)} required size={5} className="h-auto">
          {filtered.map((p) => <option key={p.id} value={p.id}>{p.name} — CI {p.document}</option>)}
        </Select>
        <p className="mt-1 text-xs text-slate-400">¿No está registrado? <Link href="/pacientes/nuevo" className="text-primary-600 hover:underline">Registrar paciente</Link></p>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profesional" name="doctor_id" required>
          <Select name="doctor_id" value={did} onChange={(e) => setDid(e.target.value)} required>
            <option value="">Seleccioná…</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Especialidad" name="specialty_id">
          <Select name="specialty_id" key={did} defaultValue={appt?.specialty_id ?? docSpecs[0]?.id ?? ""}>
            <option value="">—</option>
            {docSpecs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Fecha y hora" name="starts_at" required><Input name="starts_at" type="datetime-local" step={300} defaultValue={appt ? toLocalInput(appt.starts_at, tz) : start} required /></Field>
        <Field label="Duración" name="duration">
          <Select name="duration" defaultValue={String(duration)}>{[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutos</option>)}</Select>
        </Field>
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
            <Select name="patient_insurance_id" defaultValue={appt?.patient_insurance_id ?? activeIns[0]?.id} required>
              {activeIns.map((i) => <option key={i.id} value={i.id}>{i.insurer_name} — {i.plan_name} (afiliado {i.member_number})</option>)}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Motivo de consulta" name="reason"><Input name="reason" defaultValue={appt?.reason ?? ""} /></Field>
      <Field label="Notas internas" name="notes"><Textarea name="notes" rows={2} defaultValue={appt?.notes ?? ""} /></Field>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{state.error}</p>}
      <div className="flex justify-end"><SubmitButton>{appt ? "Guardar cambios" : "Agendar cita"}</SubmitButton></div>
    </form>
  );
}
