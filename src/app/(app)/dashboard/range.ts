import { addDays, todayISO, zonedToUtc } from "@/lib/utils";

export const PRESETS = { hoy: "Hoy", ayer: "Ayer", semana: "Esta semana", mes: "Este mes", mes_anterior: "Mes anterior", anio: "Este año" } as const;
export type Preset = keyof typeof PRESETS | "personalizado";
export type Range = { desde: string; hasta: string; preset: Preset; label: string; from: string; to: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function parseRange(sp: Record<string, string | undefined>, tz: string): Range {
  const today = todayISO(tz);
  const [y, m] = today.split("-").map(Number);
  const first = today.slice(0, 8) + "01";
  let preset = (sp.periodo ?? "") as Preset;
  let desde = today, hasta = today;
  if (sp.desde && ISO.test(sp.desde) && (!sp.periodo || sp.periodo === "personalizado")) {
    preset = "personalizado";
    desde = sp.desde;
    hasta = sp.hasta && ISO.test(sp.hasta) ? sp.hasta : sp.desde;
    if (hasta < desde) [desde, hasta] = [hasta, desde];
  } else {
    if (!(preset in PRESETS)) preset = "hoy";
    if (preset === "ayer") desde = hasta = addDays(today, -1);
    if (preset === "semana") { const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; desde = addDays(today, -dow); }
    if (preset === "mes") desde = first;
    if (preset === "mes_anterior") {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      desde = `${py}-${String(pm).padStart(2, "0")}-01`; hasta = addDays(first, -1);
    }
    if (preset === "anio") desde = `${y}-01-01`;
  }
  const label = preset !== "personalizado" ? (desde === hasta ? `${PRESETS[preset as keyof typeof PRESETS]} · ${fmt(desde)}` : `${PRESETS[preset as keyof typeof PRESETS]} · ${fmt(desde)} al ${fmt(hasta)}`)
    : desde === hasta ? fmt(desde) : `${fmt(desde)} al ${fmt(hasta)}`;
  return {
    desde, hasta, preset, label,
    from: zonedToUtc(`${desde}T00:00`, tz).toISOString(),
    to: zonedToUtc(`${addDays(hasta, 1)}T00:00`, tz).toISOString(),
  };
}

export function rangeQuery(r: Range, extra: Record<string, string | undefined> = {}) {
  const base: Record<string, string> = r.preset === "personalizado" ? { periodo: "personalizado", desde: r.desde, hasta: r.hasta } : { periodo: r.preset };
  for (const [k, v] of Object.entries(extra)) if (v) base[k] = v;
  return new URLSearchParams(base).toString();
}
