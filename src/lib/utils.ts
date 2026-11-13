import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_TZ = "America/Asuncion";

export function gs(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return "Gs. " + Math.round(n).toLocaleString("es-PY");
}

export function fmtDate(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  if (!value) return "—";
  const d = typeof value === "string" && value.length === 10 ? new Date(value + "T12:00:00Z") : new Date(value);
  return new Intl.DateTimeFormat("es-PY", { timeZone: typeof value === "string" && value.length === 10 ? "UTC" : tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function fmtDateTime(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PY", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function fmtTime(value: string | Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("es-PY", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function age(birth: string | null | undefined, today = new Date()) {
  if (!birth) return null;
  const b = new Date(birth + "T12:00:00Z");
  let a = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export function zonedParts(date: Date, tz = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year: +get("year"), month: +get("month"), day: +get("day"), hour: +get("hour"), minute: +get("minute"), second: +get("second"), weekday: wd };
}

function offsetMinutes(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUtc - date.getTime()) / 60000;
}

export function zonedToUtc(local: string, tz = DEFAULT_TZ) {
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const off = offsetMinutes(new Date(guess), tz);
  return new Date(guess - off * 60000);
}

export function todayISO(tz = DEFAULT_TZ) {
  const p = zonedParts(new Date(), tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isoDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function toLocalInput(value: string | Date, tz = DEFAULT_TZ) {
  const p = zonedParts(new Date(value), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(fd: FormData, key: string) {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function dbError(message: string | undefined) {
  if (!message) return "Ocurrió un error inesperado";
  if (message.includes("duplicate key") && message.includes("patients_clinic_id_document")) return "Ya existe un paciente con ese documento en la institución";
  if (message.includes("duplicate key")) return "Ya existe un registro con esos datos";
  if (message.includes("appointments_no_overlap_doctor")) return "El profesional ya tiene una cita en ese horario";
  if (message.includes("appointments_no_overlap_room")) return "El consultorio ya está ocupado en ese horario";
  if (message.includes("row-level security") || message.includes("permission denied")) return "No tenés permiso para realizar esta acción";
  if (message.includes("violates foreign key")) return "El registro está siendo utilizado por otros datos y no puede eliminarse";
  return message;
}
