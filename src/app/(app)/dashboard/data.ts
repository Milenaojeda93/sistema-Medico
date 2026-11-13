import "server-only";
import type { Ctx } from "@/lib/context";
import { can } from "@/lib/context";
import type { Range } from "./range";

export const DETAILS = {
  citas: "Citas agendadas",
  pendientes: "Citas pendientes",
  confirmadas: "Citas confirmadas",
  atendidas: "Citas atendidas",
  no_concretadas: "Canceladas y ausentes",
  consultas: "Consultas realizadas",
  pacientes: "Pacientes nuevos",
  ingresos: "Ingresos",
  facturas: "Facturas con saldo pendiente",
} as const;
export type Detail = keyof typeof DETAILS;

const APPT_STATUS: Record<string, string[] | null> = {
  citas: null, pendientes: ["pendiente"], confirmadas: ["confirmada"], atendidas: ["atendida"], no_concretadas: ["cancelada", "ausente"],
};

export function canSee(ctx: Ctx, d: Detail) {
  if (d in APPT_STATUS) return can(ctx.perms, "agenda");
  if (d === "consultas") return can(ctx.perms, "historias");
  if (d === "pacientes") return can(ctx.perms, "pacientes");
  return !ctx.ownOnly && (can(ctx.perms, "facturacion") || can(ctx.perms, "caja"));
}

/** Números de las tarjetas para el período. */
export async function cardCounts(ctx: Ctx, r: Range) {
  const c = ctx.clinic.id;
  const apptCount = (statuses: string[] | null, exclude?: string) => {
    let q = ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", c).gte("starts_at", r.from).lt("starts_at", r.to);
    if (statuses) q = q.in("status", statuses);
    if (exclude) q = q.neq("status", exclude);
    return q;
  };
  const money = canSee(ctx, "ingresos");
  const [citas, pend, conf, aten, noc, cons, pac, pay, ins, inv] = await Promise.all([
    apptCount(null, "cancelada"), apptCount(["pendiente"]), apptCount(["confirmada"]), apptCount(["atendida"]), apptCount(["cancelada", "ausente"]),
    ctx.supabase.from("consultations").select("id", { count: "exact", head: true }).eq("clinic_id", c).gte("consulted_at", r.from).lt("consulted_at", r.to),
    ctx.supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", c).gte("created_at", r.from).lt("created_at", r.to),
    money ? ctx.supabase.from("payments").select("amount").eq("clinic_id", c).gte("paid_at", r.from).lt("paid_at", r.to).limit(20000) : Promise.resolve({ data: [] }),
    money ? ctx.supabase.from("insurer_payments").select("amount").eq("clinic_id", c).gte("paid_at", r.desde).lte("paid_at", r.hasta).limit(5000) : Promise.resolve({ data: [] }),
    money ? ctx.supabase.from("invoices").select("patient_amount, patient_paid").eq("clinic_id", c).in("status", ["pendiente", "parcial"]).gte("issue_date", r.desde).lte("issue_date", r.hasta).limit(20000) : Promise.resolve({ data: [] }),
  ]);
  const sum = (xs: { amount: number }[] | null) => (xs ?? []).reduce((a, x) => a + Number(x.amount), 0);
  const invs = (inv.data ?? []) as { patient_amount: number; patient_paid: number }[];
  return {
    citas: citas.count ?? 0, pendientes: pend.count ?? 0, confirmadas: conf.count ?? 0, atendidas: aten.count ?? 0, no_concretadas: noc.count ?? 0,
    consultas: cons.count ?? 0, pacientes: pac.count ?? 0,
    ingresos_particular: sum(pay.data as { amount: number }[]), ingresos_aseguradoras: sum(ins.data as { amount: number }[]),
    facturas: invs.length, facturas_saldo: invs.reduce((a, x) => a + Number(x.patient_amount) - Number(x.patient_paid), 0),
  };
}

/** Datos para los gráficos del período. */
export async function rangeCharts(ctx: Ctx, r: Range) {
  const c = ctx.clinic.id;
  const [{ data: cons }, { data: appts }] = await Promise.all([
    ctx.supabase.from("consultations").select("consulted_at, specialties(name)").eq("clinic_id", c).gte("consulted_at", r.from).lt("consulted_at", r.to).limit(20000),
    ctx.supabase.from("appointments").select("care_type").eq("clinic_id", c).neq("status", "cancelada").gte("starts_at", r.from).lt("starts_at", r.to).limit(20000),
  ]);
  type C = { consulted_at: string; specialties: { name: string } | null };
  const list = (cons ?? []) as unknown as C[];
  const days: { date: string; total: number }[] = [];
  const span = Math.round((Date.parse(r.hasta) - Date.parse(r.desde)) / 86400000) + 1;
  const byMonth = span > 62;
  const key = (iso: string) => {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
    return byMonth ? d.slice(0, 7) : d;
  };
  const counts = new Map<string, number>();
  for (const x of list) counts.set(key(x.consulted_at), (counts.get(key(x.consulted_at)) ?? 0) + 1);
  if (byMonth) {
    let cur = r.desde.slice(0, 7);
    while (cur <= r.hasta.slice(0, 7)) {
      days.push({ date: cur + "-01", total: counts.get(cur) ?? 0 });
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  } else {
    for (let i = 0; i < span; i++) {
      const d = new Date(Date.parse(r.desde + "T12:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      days.push({ date: d, total: counts.get(d) ?? 0 });
    }
  }
  const spec = new Map<string, number>();
  for (const x of list) { const n = x.specialties?.name ?? "Sin especialidad"; spec.set(n, (spec.get(n) ?? 0) + 1); }
  const care = new Map<string, number>();
  for (const a of (appts ?? []) as { care_type: string }[]) care.set(a.care_type, (care.get(a.care_type) ?? 0) + 1);
  return {
    byMonth,
    consultations: days,
    bySpecialty: [...spec].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    careType: [...care].map(([name, total]) => ({ name, total })),
  };
}

export type Row = { cells: (string | number | null)[]; href?: string; tone?: string; badge?: { label: string; tone: string } | null };
export type DetailTable = { columns: string[]; numeric: number[]; rows: Row[]; total?: { label: string; value: number } };

/** Filas detalladas de una tarjeta. */
export async function detailRows(ctx: Ctx, d: Detail, r: Range, f: { medico?: string; q?: string }): Promise<DetailTable> {
  const c = ctx.clinic.id;
  const q = (f.q ?? "").trim().toLowerCase();
  const match = (...xs: (string | null | undefined)[]) => !q || xs.some((x) => (x ?? "").toLowerCase().includes(q));
  const dt = (iso: string) => new Intl.DateTimeFormat("es-PY", { timeZone: ctx.tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const name = (p: { first_name: string; last_name: string } | null) => (p ? `${p.last_name}, ${p.first_name}` : "—");

  if (d in APPT_STATUS) {
    let query = ctx.supabase.from("appointments")
      .select("id, starts_at, status, care_type, reason, patients(id, first_name, last_name, document, phone), doctors(full_name), specialties(name), rooms(name), patient_insurances(insurers(trade_name))")
      .eq("clinic_id", c).gte("starts_at", r.from).lt("starts_at", r.to).order("starts_at").limit(2000);
    const st = APPT_STATUS[d];
    query = st ? query.in("status", st) : query.neq("status", "cancelada");
    if (f.medico) query = query.eq("doctor_id", f.medico);
    const { data } = await query;
    type A = { id: string; starts_at: string; status: string; care_type: string; reason: string | null; patients: { id: string; first_name: string; last_name: string; document: string; phone: string | null } | null; doctors: { full_name: string } | null; specialties: { name: string } | null; rooms: { name: string } | null; patient_insurances: { insurers: { trade_name: string } | null } | null };
    const rows = ((data ?? []) as unknown as A[]).filter((a) => match(a.patients?.first_name, a.patients?.last_name, a.patients?.document, a.doctors?.full_name));
    return {
      columns: ["Fecha y hora", "Paciente", "CI", "Teléfono", "Médico", "Especialidad", "Consultorio", "Atención", "Motivo", "Estado"],
      numeric: [],
      rows: rows.map((a) => ({
        href: a.patients ? `/pacientes/${a.patients.id}` : undefined,
        cells: [dt(a.starts_at), name(a.patients), a.patients?.document ?? "—", a.patients?.phone ?? "—", a.doctors?.full_name ?? "—", a.specialties?.name ?? "—", a.rooms?.name ?? "—",
          a.care_type === "seguro" ? `Seguro · ${a.patient_insurances?.insurers?.trade_name ?? ""}` : "Particular", a.reason ?? "—"],
        badge: { label: a.status, tone: "appt" },
      })),
    };
  }

  if (d === "consultas") {
    let query = ctx.supabase.from("consultations")
      .select("id, consulted_at, status, diagnosis, patients(id, first_name, last_name, document), doctors(full_name), specialties(name)")
      .eq("clinic_id", c).gte("consulted_at", r.from).lt("consulted_at", r.to).order("consulted_at").limit(2000);
    if (f.medico) query = query.eq("doctor_id", f.medico);
    const { data } = await query;
    type K = { id: string; consulted_at: string; status: string; diagnosis: string | null; patients: { id: string; first_name: string; last_name: string; document: string } | null; doctors: { full_name: string } | null; specialties: { name: string } | null };
    const rows = ((data ?? []) as unknown as K[]).filter((k) => match(k.patients?.first_name, k.patients?.last_name, k.patients?.document, k.doctors?.full_name, k.diagnosis));
    return {
      columns: ["Fecha y hora", "Paciente", "CI", "Médico", "Especialidad", "Diagnóstico", "Estado"],
      numeric: [],
      rows: rows.map((k) => ({
        href: `/consultas/${k.id}`,
        cells: [dt(k.consulted_at), name(k.patients), k.patients?.document ?? "—", k.doctors?.full_name ?? "—", k.specialties?.name ?? "—", k.diagnosis ?? "—"],
        badge: { label: k.status === "cerrada" ? "Cerrada" : "Abierta", tone: k.status === "cerrada" ? "gray" : "amber" },
      })),
    };
  }

  if (d === "pacientes") {
    const { data } = await ctx.supabase.from("patients").select("id, first_name, last_name, document, phone, email, city, birth_date, created_at")
      .eq("clinic_id", c).gte("created_at", r.from).lt("created_at", r.to).order("created_at").limit(2000);
    const rows = (data ?? []).filter((p) => match(p.first_name, p.last_name, p.document, p.phone));
    return {
      columns: ["Registrado", "Paciente", "CI", "Teléfono", "Correo", "Ciudad"],
      numeric: [],
      rows: rows.map((p) => ({ href: `/pacientes/${p.id}`, cells: [dt(p.created_at), name(p), p.document, p.phone ?? "—", p.email ?? "—", p.city ?? "—"] })),
    };
  }

  if (d === "ingresos") {
    const [{ data: pays }, { data: ins }] = await Promise.all([
      ctx.supabase.from("payments").select("amount, method, reference, paid_at, invoices(id, number, patients(first_name, last_name, document))")
        .eq("clinic_id", c).gte("paid_at", r.from).lt("paid_at", r.to).order("paid_at").limit(5000),
      ctx.supabase.from("insurer_payments").select("amount, paid_at, reference, insurer_settlements(id, number, insurers(trade_name))")
        .eq("clinic_id", c).gte("paid_at", r.desde).lte("paid_at", r.hasta).order("paid_at").limit(2000),
    ]);
    type P = { amount: number; method: string; reference: string | null; paid_at: string; invoices: { id: string; number: string; patients: { first_name: string; last_name: string; document: string } | null } | null };
    type I = { amount: number; paid_at: string; reference: string | null; insurer_settlements: { id: string; number: string; insurers: { trade_name: string } | null } | null };
    const METHOD: Record<string, string> = { efectivo: "Efectivo", tarjeta_debito: "Tarjeta de débito", tarjeta_credito: "Tarjeta de crédito", transferencia: "Transferencia", cheque: "Cheque", otro: "Otro" };
    const rows: Row[] = [
      ...((pays ?? []) as unknown as P[]).filter((p) => match(p.invoices?.patients?.first_name, p.invoices?.patients?.last_name, p.invoices?.number)).map((p) => ({
        href: p.invoices ? `/facturacion/${p.invoices.id}` : undefined,
        cells: [dt(p.paid_at), "Paciente", name(p.invoices?.patients ?? null), p.invoices?.number ?? "—", METHOD[p.method] ?? p.method, p.reference ?? "—", Number(p.amount)],
      })),
      ...((ins ?? []) as unknown as I[]).filter((p) => match(p.insurer_settlements?.insurers?.trade_name, p.insurer_settlements?.number)).map((p) => ({
        href: p.insurer_settlements ? `/facturacion/aseguradoras/${p.insurer_settlements.id}` : undefined,
        cells: [p.paid_at.split("-").reverse().join("/"), "Aseguradora", p.insurer_settlements?.insurers?.trade_name ?? "—", p.insurer_settlements?.number ?? "—", "Pago de liquidación", p.reference ?? "—", Number(p.amount)],
      })),
    ];
    return { columns: ["Fecha", "Origen", "Pagador", "Comprobante", "Método", "Referencia", "Monto"], numeric: [6], rows, total: { label: "Total cobrado", value: rows.reduce((a, x) => a + Number(x.cells[6]), 0) } };
  }

  // facturas con saldo
  const { data } = await ctx.supabase.from("invoices").select("id, number, issue_date, care_type, total, patient_amount, patient_paid, status, patients(first_name, last_name, document)")
    .eq("clinic_id", c).in("status", ["pendiente", "parcial"]).gte("issue_date", r.desde).lte("issue_date", r.hasta).order("issue_date").limit(5000);
  type V = { id: string; number: string; issue_date: string; care_type: string; total: number; patient_amount: number; patient_paid: number; status: string; patients: { first_name: string; last_name: string; document: string } | null };
  const rows = ((data ?? []) as unknown as V[]).filter((v) => match(v.patients?.first_name, v.patients?.last_name, v.patients?.document, v.number));
  return {
    columns: ["Emitida", "Factura", "Paciente", "CI", "Atención", "Total", "A cargo del paciente", "Pagado", "Saldo"],
    numeric: [5, 6, 7, 8],
    rows: rows.map((v) => ({
      href: `/facturacion/${v.id}`,
      cells: [v.issue_date.split("-").reverse().join("/"), v.number, name(v.patients), v.patients?.document ?? "—", v.care_type === "seguro" ? "Seguro" : "Particular",
        Number(v.total), Number(v.patient_amount), Number(v.patient_paid), Number(v.patient_amount) - Number(v.patient_paid)],
      badge: { label: v.status === "parcial" ? "Pago parcial" : "Pendiente", tone: v.status === "parcial" ? "amber" : "red" },
    })),
    total: { label: "Saldo total", value: rows.reduce((a, v) => a + Number(v.patient_amount) - Number(v.patient_paid), 0) },
  };
}
