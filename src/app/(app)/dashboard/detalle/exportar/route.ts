import { getCtx, can } from "@/lib/context";
import { DETAILS, canSee, detailRows, type Detail } from "../../data";
import { parseRange } from "../../range";
import { APPOINTMENT_STATUS } from "@/lib/constants";

export async function GET(req: Request) {
  const ctx = await getCtx();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const tipo = sp.tipo as Detail;
  if (!can(ctx.perms, "dashboard") || !(tipo in DETAILS) || !canSee(ctx, tipo)) return new Response("Sin permiso", { status: 403 });
  const r = parseRange(sp, ctx.tz);
  const t = await detailRows(ctx, tipo, r, { medico: sp.medico, q: sp.q });
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const hasBadge = t.rows.some((x) => x.badge);
  const lines = [esc(`${ctx.clinic.name} · ${DETAILS[tipo]} · ${r.label}`), "", [...t.columns, ...(hasBadge ? ["Estado"] : [])].map(esc).join(";")];
  for (const row of t.rows) lines.push([...row.cells, ...(hasBadge ? [row.badge?.tone === "appt" ? (APPOINTMENT_STATUS[row.badge.label]?.label ?? row.badge.label) : (row.badge?.label ?? "")] : [])].map(esc).join(";"));
  if (t.total) lines.push("", `${esc(t.total.label)};${t.total.value}`);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="medvia-${tipo}-${r.desde}-a-${r.hasta}.csv"`, "Cache-Control": "no-store" },
  });
}
