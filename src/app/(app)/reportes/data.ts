import "server-only";
import type { Ctx } from "@/lib/context";
import { addDays, todayISO, zonedToUtc } from "@/lib/utils";

export type Filters = { desde: string; hasta: string; medico: string; especialidad: string; aseguradora: string };
export type Table = { title: string; columns: string[]; rows: (string | number)[][]; money?: number[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: Record<string, string | undefined>, tz: string): Filters {
  const today = todayISO(tz);
  const desde = sp.desde && ISO.test(sp.desde) ? sp.desde : today.slice(0, 8) + "01";
  const hasta = sp.hasta && ISO.test(sp.hasta) ? sp.hasta : today;
  return { desde, hasta: hasta < desde ? desde : hasta, medico: sp.medico ?? "", especialidad: sp.especialidad ?? "", aseguradora: sp.aseguradora ?? "" };
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
function group<T>(list: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of list) { const k = key(x); m.set(k, [...(m.get(k) ?? []), x]); }
  return m;
}

type Appt = { status: string; care_type: string; doctor_id: string; specialty_id: string | null; doctors: { full_name: string } | null; specialties: { name: string } | null; patient_insurances: { insurer_id: string; insurers: { trade_name: string } | null } | null };

export async function attentionReport(ctx: Ctx, f: Filters) {
  let q = ctx.supabase.from("appointments")
    .select("status, care_type, doctor_id, specialty_id, doctors(full_name), specialties(name), patient_insurances(insurer_id, insurers(trade_name))")
    .eq("clinic_id", ctx.clinic.id)
    .gte("starts_at", zonedToUtc(`${f.desde}T00:00`, ctx.tz).toISOString())
    .lt("starts_at", zonedToUtc(`${addDays(f.hasta, 1)}T00:00`, ctx.tz).toISOString())
    .limit(50000);
  if (f.medico) q = q.eq("doctor_id", f.medico);
  if (f.especialidad) q = q.eq("specialty_id", f.especialidad);
  const { data } = await q;
  let list = (data ?? []) as unknown as Appt[];
  if (f.aseguradora) list = list.filter((a) => a.patient_insurances?.insurer_id === f.aseguradora);

  const count = (xs: Appt[], s: string) => xs.filter((a) => a.status === s).length;
  const summary = {
    total: list.length,
    atendidas: count(list, "atendida"),
    canceladas: count(list, "cancelada"),
    ausentes: count(list, "ausente"),
    particular: list.filter((a) => a.care_type !== "seguro").length,
    seguro: list.filter((a) => a.care_type === "seguro").length,
  };
  const row = (name: string, xs: Appt[]) => {
    const att = count(xs, "atendida"), can = count(xs, "cancelada"), aus = count(xs, "ausente");
    return [name, xs.length, att, xs.filter((a) => a.care_type !== "seguro" && a.status === "atendida").length, xs.filter((a) => a.care_type === "seguro" && a.status === "atendida").length, can, aus, `${pct(can + aus, xs.length)}%`];
  };
  const cols = ["", "Citas", "Atendidas", "Particular", "Por seguro", "Canceladas", "Ausentes", "% no concretadas"];
  const sortRows = (rows: (string | number)[][]) => rows.sort((a, b) => Number(b[1]) - Number(a[1]));

  const byDoctor: Table = { title: "Por médico", columns: ["Médico", ...cols.slice(1)], rows: sortRows([...group(list, (a) => a.doctors?.full_name ?? "—")].map(([k, v]) => row(k, v))) };
  const bySpec: Table = { title: "Por especialidad", columns: ["Especialidad", ...cols.slice(1)], rows: sortRows([...group(list, (a) => a.specialties?.name ?? "Sin especialidad")].map(([k, v]) => row(k, v))) };
  const ins = list.filter((a) => a.care_type === "seguro");
  const byInsurer: Table = { title: "Por aseguradora", columns: ["Aseguradora", ...cols.slice(1)], rows: sortRows([...group(ins, (a) => a.patient_insurances?.insurers?.trade_name ?? "—")].map(([k, v]) => row(k, v))) };
  return { summary, tables: [byDoctor, bySpec, byInsurer] };
}

export async function diagnosisReport(ctx: Ctx, f: Filters) {
  let q = ctx.supabase.from("consultations").select("diagnosis, diagnosis_code, doctor_id, specialty_id")
    .eq("clinic_id", ctx.clinic.id).not("diagnosis", "is", null)
    .gte("consulted_at", zonedToUtc(`${f.desde}T00:00`, ctx.tz).toISOString())
    .lt("consulted_at", zonedToUtc(`${addDays(f.hasta, 1)}T00:00`, ctx.tz).toISOString())
    .limit(50000);
  if (f.medico) q = q.eq("doctor_id", f.medico);
  if (f.especialidad) q = q.eq("specialty_id", f.especialidad);
  const { data } = await q;
  const list = (data ?? []) as { diagnosis: string; diagnosis_code: string | null }[];
  const m = new Map<string, { label: string; code: string; n: number }>();
  for (const c of list) {
    const label = c.diagnosis.trim();
    const key = (c.diagnosis_code?.trim().toUpperCase() || label.toLowerCase());
    const cur = m.get(key) ?? { label, code: c.diagnosis_code?.trim().toUpperCase() ?? "", n: 0 };
    cur.n++;
    m.set(key, cur);
  }
  const rows = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 50).map((x, i) => [i + 1, x.label, x.code || "—", x.n, `${pct(x.n, list.length)}%`]);
  return { total: list.length, table: { title: "Diagnósticos más frecuentes", columns: ["#", "Diagnóstico", "CIE-10", "Consultas", "% del total"], rows } as Table };
}

type Inv = { issue_date: string; total: number; insurer_amount: number; patient_amount: number; patient_paid: number; care_type: string; insurer_id: string | null; insurers: { trade_name: string } | null; status: string; invoice_items: { description: string; quantity: number; line_total: number }[] };

export async function billingReport(ctx: Ctx, f: Filters) {
  let q = ctx.supabase.from("invoices")
    .select("issue_date, total, insurer_amount, patient_amount, patient_paid, care_type, insurer_id, insurers(trade_name), status, invoice_items(description, quantity, line_total)")
    .eq("clinic_id", ctx.clinic.id).neq("status", "anulada").gte("issue_date", f.desde).lte("issue_date", f.hasta).limit(20000);
  if (f.aseguradora) q = q.eq("insurer_id", f.aseguradora);
  const { data } = await q;
  const list = (data ?? []) as unknown as Inv[];
  const sum = (xs: Inv[], k: keyof Inv) => xs.reduce((a, x) => a + Number(x[k] ?? 0), 0);
  const summary = {
    facturas: list.length, total: sum(list, "total"), aseguradoras: sum(list, "insurer_amount"),
    pacientes: sum(list, "patient_amount"), cobrado: sum(list, "patient_paid"), pendiente: sum(list, "patient_amount") - sum(list, "patient_paid"),
  };
  const byMonth: Table = {
    title: "Por mes", columns: ["Mes", "Facturas", "Total", "Aseguradoras", "Pacientes", "Cobrado a pacientes"], money: [2, 3, 4, 5],
    rows: [...group(list, (x) => x.issue_date.slice(0, 7))].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.length, sum(v, "total"), sum(v, "insurer_amount"), sum(v, "patient_amount"), sum(v, "patient_paid")]),
  };
  const byInsurer: Table = {
    title: "Por aseguradora", columns: ["Aseguradora", "Facturas", "A cargo de la aseguradora", "A cargo del paciente"], money: [2, 3],
    rows: [...group(list.filter((x) => x.care_type === "seguro"), (x) => x.insurers?.trade_name ?? "—")].map(([k, v]) => [k, v.length, sum(v, "insurer_amount"), sum(v, "patient_amount")] as (string | number)[]).sort((a, b) => Number(b[2]) - Number(a[2])),
  };
  const items = new Map<string, { n: number; t: number }>();
  for (const inv of list) for (const it of inv.invoice_items) {
    const cur = items.get(it.description) ?? { n: 0, t: 0 };
    cur.n += Number(it.quantity); cur.t += Number(it.line_total);
    items.set(it.description, cur);
  }
  const byService: Table = {
    title: "Servicios más facturados", columns: ["Servicio", "Cantidad", "Importe"], money: [2],
    rows: [...items].sort((a, b) => b[1].t - a[1].t).slice(0, 30).map(([k, v]) => [k, v.n, v.t]),
  };
  return { summary, tables: [byMonth, byInsurer, byService] };
}

export function toCSV(tables: Table[], header: string) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [esc(header), ""];
  for (const t of tables) {
    lines.push(esc(t.title));
    lines.push(t.columns.map(esc).join(";"));
    for (const r of t.rows) lines.push(r.map(esc).join(";"));
    lines.push("");
  }
  return "﻿" + lines.join("\r\n");
}
